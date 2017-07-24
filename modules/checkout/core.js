import R from 'ramda'
import axios from 'axios'
import moment from 'moment'
import {
  __ENV__,
  SUPPORT_EMAIL,
  ORDER_EMAILS,
  PROFESSIONAL_ADD_BILLING_NOTIFICATION_EMAILS,
  MAILCHIMP_LOYALTY_LIST_ID,
  MAILCHIMP_PROFESSIONAL_FREE_SAMPLE_LIST_ID,
  MAILCHIMP_PROFESSIONAL_BUYER_LIST_ID,
} from '../global/constants'
import {changeState} from '../state/events'
import {getElemState} from '../state/core'
import {
  OUTCOME_MESSAGE_ID,
  PAY_BUTTON_ID,
} from '../state/constants'
import {
  checkIsExistingCustomer,
  checkIsFreeSample,
  getCartItemsWithDetail,
  getProductContent,
  getTotalQuantity,
  getShippingMethodTitle,
  getDiscount,
  getReferralCredit,
  getSubtotal,
  getSalesTax,
  getShippingOptions,
  getShippingRate,
  getTotal,
  handleReferral,
  sendOrderEmail,
  createShippingLabels,
  processXero$$,
  resetAllFields,
  runFinalCleanup,
} from './utils'
import {createCustomerAndCharge$$, charge$$, createCustomer$$} from '../stripe/observables'
import {subscribeNewMember$$, deleteMember$$} from '../mailchimp/observables'
import {createOrder} from '../orders/core'
import {saveOrder} from '../orders/graphql'
import {createScheduledCharge} from '../scheduled-charges/graphql'
import {hidePageLoading} from '../page-loading/core'

/**
 * 1) If updateBilling === true, run updateBillingInfo().
 *    handleStripeOutcome() will run handleCreateCustomerStripeTokenSuccess()
 * 2) If updateBilling !== true, then see if billing already exists (i.e. customer !== nil).
 *    a) If billing already exists, don't show payment form. Run chargeExistingPro().
 *    b) If billing doesn't exist, show payment form and run charge(). charge() will see if this user is pro (i.e. userProfile !== nil)
 *      i) If the user is pro, handleStripeOutcome() will run handleProStripeTokenSuccess()
 *      ii) If the user is NOT pro, handleStripeOutcome() will run handleRetailStripeTokenSuccess()
 */

/**
 * RETAIL
 */

function handleRetailStripeTokenSuccess(token, props, formData) {
  const {locale, coupon, shippingDetails, userProfile, countryCode} = props
  const {couponId = 'None'} = coupon
  const shippingOptions = getShippingOptions(props)
  const cartItemsWithDetail = getCartItemsWithDetail(props)
  const {currency} = locale
  const {email, billingAddress, shippingAddress, phone, shippingMethod, salesTax} = formData
  const shippingRate = getShippingRate(props, shippingMethod)
  const total = getTotal(props, formData)
  const {
    name: shippingName,
    line1: shippingLine1,
    city: shippingCity,
    state: shippingState,
    zip: shippingZip,
    country: shippingCountry,
  } = shippingAddress
  const tokenObj = R.merge(token, {email})
  const stripeAddress = {
    shipping_name: shippingName,
    shipping_address_city: shippingCity,
    shipping_address_country: shippingCountry,
    shipping_address_line1: shippingLine1,
    shipping_address_zip: shippingZip,
    shipping_address_state: shippingState,
  }
  const stripeMetadata = {
    name: shippingName,
    phone,
    couponId,
    business_name: 'N/A',
    shipping_method: getShippingMethodTitle(shippingOptions, shippingMethod),
    shipping_price: shippingRate / 100,
    sales_tax: salesTax / 100,
    products: getProductContent(cartItemsWithDetail),
    quantity: getTotalQuantity(cartItemsWithDetail),
    professional_free_sample: false,
  }
  const stripeOptions = {
    amount: total,
    currency,
  }

  // create a Stripe customer and charge him/her right away
  createCustomerAndCharge$$(tokenObj, stripeAddress, stripeMetadata, stripeOptions).subscribe(
    chargeData => {
      // console.log('Creating customer and card charge successful!', chargeData)
      handleRetailChargeSuccess(props, formData, chargeData)
    },
    err => {
      const error = {
        message: `Something went wrong while creating/saving customer or charging card: ${err}`
      }
      console.log(error.message)
      handleStripeError(error)
    }
  )
}

function handleRetailChargeSuccess(props, formData, chargeData) {
  const {receipt_email: email, metadata: chargeMetadata, amount} = chargeData
  const {name, phone, business_name, line1, postal_code, city, state, country, shipping_method} = chargeMetadata
  const {isPos, onRetailChargeSuccess, track, locale, cartItems, productDetails, addToEmailList = true, rootState} = props
  const cartItemsWithDetail = getCartItemsWithDetail(props)
  const {currency} = locale

  // track purchase
  track.purchase(email, currency, cartItemsWithDetail)

  // Subscribe the user to the email list (MailChimp) if they opted in
  if (addToEmailList) {
    const mailchimpPayload = {
      email_address: email,
      status: 'subscribed',
    }
    subscribeNewMember$$(MAILCHIMP_LOYALTY_LIST_ID, mailchimpPayload).subscribe(
      res => console.log('MailChimp subscribe successful! ', res),
      err => console.log('Error while subscribing to MailChimp: ', err)
    )
  }

  // send order email to fulfillment using Sendgrid
  const fromEmail = {email: SUPPORT_EMAIL}
  const toEmailArray = R.map(email => { return {email}})(ORDER_EMAILS)
  const productsContent = getProductContent(cartItemsWithDetail)
  const orderDetails = R.merge({
    email,
    amount: amount / 100,
    currency,
    created: moment().format('MMM Do YYYY, h:mm:ss a'),
  }, chargeMetadata)
  const orderDetailsPairs = R.toPairs(orderDetails) // [['key', 'value'], ['key', 'value'], ...]
  const subject = `[ORDER] order for ${productsContent} from ${email} to ${city}, ${country} via ${shipping_method}`
  const content = R.reduce((prev, curr) => prev + `${R.head(curr)}: ${R.last(curr)}\n\n`, '')(orderDetailsPairs)

  const payload = {
    toEmailArray,
    fromEmail,
    subject,
    content
  }
  sendOrderEmail(payload)

  // Save order
  const customerInfo = {
    email,
    name,
    businessName: business_name,
    phone,
  }
  const shipping = {
    address_line1: line1,
    address_zip: postal_code,
    address_city: city,
    address_state: state,
    address_country: country,
  }
  const orderObj = createOrder(productDetails, cartItems, customerInfo, shipping, shipping_method)
  saveOrder(orderObj)

  /**
   * Shippo: Create shipment and shipping label
   */
  createShippingLabels(props, formData, orderObj)

  /**
   * Xero:
   *    1) Create customer (or update)
   *    2) Create an invoice
   *    3) Mark it paid if payment is immediate
   */
  processXero$$(props, formData, orderObj).subscribe(
    invoiceObj => console.log('Processing Xero successful'),
    err => console.log('Something went wrong while processing Xero', err)
  )

  // // Reset all fields
  // resetAllFields(props)

  // Handle post charge clean up
  onRetailChargeSuccess(isPos, rootState, chargeData)

  // Re-enable the button, show success icon, disable page loading
  runFinalCleanup(props)
}

/**
 * PRO
 * NOTE: Handles both new and existing customer charges
 *       Existing customers simply skip the customer creation process in the backend
 */

function handleProStripeTokenSuccess(token, props, formData) {
  const {locale, coupon, userProfile, shippingDetails, countryCode} = props
  const {couponId = 'None'} = coupon
  const cartItemsWithDetail = getCartItemsWithDetail(props)
  const shippingOptions = getShippingOptions(props)
  const {metadata: userProfileMetadata} = userProfile
  const {businessName} = userProfileMetadata
  const {currency} = locale
  const {email, billingAddress, shippingAddress, phone, shippingMethod, salesTax} = formData
  const shippingRate = getShippingRate(props, shippingMethod)
  const total = getTotal(props, formData)
  const {
    name: shippingName,
    line1: shippingLine1,
    city: shippingCity,
    state: shippingState,
    zip: shippingZip,
    country: shippingCountry,
  } = shippingAddress
  const tokenObj = R.merge(token, {email})
  const stripeAddress = {
    shipping_name: shippingName,
    shipping_address_city: shippingCity,
    shipping_address_country: shippingCountry,
    shipping_address_line1: shippingLine1,
    shipping_address_zip: shippingZip,
    shipping_address_state: shippingState,
  }
  const stripeMetadata = {
    name: shippingName,
    phone,
    couponId,
    business_name: businessName,
    shipping_method: getShippingMethodTitle(shippingOptions, shippingMethod),
    shipping_price: shippingRate / 100,
    sales_tax: salesTax / 100,
    products: getProductContent(cartItemsWithDetail),
    quantity: getTotalQuantity(cartItemsWithDetail),
    professional_free_sample: false,
  }
  const stripeOptions = {
    amount: total,
    currency,
  }

  // create a Stripe customer and charge him/her right away
  createCustomerAndCharge$$(tokenObj, stripeAddress, stripeMetadata, stripeOptions).subscribe(
    chargeData => {
      console.log('Creating customer and card charge successful!', chargeData)
      handleProChargeSuccess(props, formData, chargeData)
    },
    err => {
      const error = {
        message: `Something went wrong while creating/saving customer or charging card: ${err}`
      }
      console.log(error.message)
      handleStripeError(error)
    }
  )
}

function handleProChargeSuccess(props, formData, chargeData) {
  const {receipt_email: email, metadata: chargeMetadata, amount} = chargeData
  const {name, phone, business_name, line1, postal_code, city, state, country, shipping_method} = chargeMetadata
  const {
    isPos,
    onProChargeSuccess,
    track,
    locale,
    cartItems,
    productDetails,
    userProfile,
    customer,
    addToEmailList = true,
    rootState,
  } = props
  const cartItemsWithDetail = getCartItemsWithDetail(props)
  const {currency} = locale

  // Track purchase
  track.professionalPurchase(email, currency, cartItemsWithDetail)

  // Handle referral business
  handleReferral(props, formData)

  // Subscribe the user to the email list (MailChimp) if they opted in
  // Don't run if customer already exists (since they're already in the buyer list)
  // TODO: For now, only add to email list if not POS
  const isExistingCustomer = checkIsExistingCustomer(props)
  if (addToEmailList && !isExistingCustomer && !isPos) {
    const {businessName, fname, lname} = R.prop('metadata', userProfile) || {}
    const mailchimpPayload = {
      email_address: email,
      status: 'subscribed',
      merge_fields: {
        'FNAME': fname,
        'LNAME': lname,
        'BNAME': businessName,
      },
    }
    subscribeNewMember$$(MAILCHIMP_PROFESSIONAL_BUYER_LIST_ID, mailchimpPayload)
      .flatMap(res => {
        console.log('MailChimp subscribe to professional buyer list successful! ', res)
        return Rx.Observable.zip(
          deleteMember$$(MAILCHIMP_PROFESSIONAL_FREE_SAMPLE_LIST_ID, email),
          deleteMember$$(MAILCHIMP_LOYALTY_LIST_ID, email)
        )
      })
      .subscribe(
        res => console.log('MailChimp remove from free sample and loyalty list successful! ', res),
        err => console.log('Error while subscribing to MailChimp professional buyer list: ', err)
      )
  }

  // send order email to fulfillment using Sendgrid
  const fromEmail = {email: SUPPORT_EMAIL}
  const toEmailArray = R.map(email => { return {email}})(ORDER_EMAILS)
  const productsContent = getProductContent(cartItemsWithDetail)
  const orderDetails = R.merge({
    email,
    amount: amount / 100,
    currency,
    created: moment().format('MMM Do YYYY, h:mm:ss a'),
  }, chargeMetadata)
  const orderDetailsPairs = R.toPairs(orderDetails) // [['key', 'value'], ['key', 'value'], ...]
  const subject = `[ORDER - WHOLESALE] order for ${productsContent} from ${email} to ${city}, ${country} via ${shipping_method}`
  const content = R.reduce((prev, curr) => prev + `${R.head(curr)}: ${R.last(curr)}\n\n`, '')(orderDetailsPairs)

  const payload = {
    toEmailArray,
    fromEmail,
    subject,
    content
  }
  sendOrderEmail(payload)

  // Save order
  const customerInfo = {
    email,
    name,
    businessName: business_name,
    phone,
  }
  const shipping = {
    address_line1: line1,
    address_zip: postal_code,
    address_city: city,
    address_state: state,
    address_country: country,
  }
  const orderObj = createOrder(productDetails, cartItems, customerInfo, shipping, shipping_method)
  saveOrder(orderObj)

  /**
   * Shippo: Create shipment and shipping label
   */
  createShippingLabels(props, formData, orderObj)

  /**
   * Xero:
   *    1) Create customer (or update)
   *    2) Create an invoice
   *    3) Mark it paid if payment is immediate
   */
  processXero$$(props, formData, orderObj).subscribe(
    invoiceObj => console.log('Processing Xero successful'),
    err => console.log('Something went wrong while processing Xero', err)
  )

  // // Reset all fields
  // resetAllFields(props)

  // Handle post charge clean up
  onProChargeSuccess(isPos, rootState, chargeData)

  // Re-enable the button, show success icon, disable page loading
  runFinalCleanup(props)
}

/**
 * CREATE CUSTOMER
 *    1) UPDATE BILLING
 *    2) SCHEDULED CHARGE
 */

function handleCreateCustomerStripeTokenSuccess(token, props, formData) {
  const {locale, userProfile} = props
  const {metadata: userProfileMetadata} = userProfile
  const {businessName} = userProfileMetadata
  const {currency} = locale
  const {email, billingAddress, shippingAddress, phone} = formData
  const {
    name: shippingName,
    line1: shippingLine1,
    city: shippingCity,
    state: shippingState,
    zip: shippingZip,
    country: shippingCountry,
  } = shippingAddress
  const tokenObj = R.merge(token, {email})
  const stripeAddress = {
    shipping_name: shippingName,
    shipping_address_city: shippingCity,
    shipping_address_country: shippingCountry,
    shipping_address_line1: shippingLine1,
    shipping_address_zip: shippingZip,
    shipping_address_state: shippingState,
  }
  const stripeMetadata = {
    name: shippingName,
    phone,
    business_name: businessName,
    professional_free_sample: false,
  }

  // create a Stripe customer
  createCustomer$$(tokenObj, stripeAddress, stripeMetadata).subscribe(
    customerObj => {
      // console.log('Creating customer successful!', customerObj)
      handleCreateCustomerSuccess(props, formData, customerObj)
    },
    err => {
      handleStripeError(err)
    }
  )
}

function handleCreateCustomerSuccess(props, formData, customerObj) {
  const {
    isPos,
    rootState,
    locale,
    addToEmailList,
    customer,
    userProfile,
    track,
    productDetails,
    cartItems,
    onCreateCustomerSuccess,
    onScheduledChargeSuccess,
  } = props
  const {currency} = locale
  const cartItemsWithDetail = getCartItemsWithDetail(props)
  const {metadata: customerMetadata, id: customerId} = customerObj
  const {name, phone} = customerMetadata
  const {email, metadata: userProfileMetadata} = userProfile
  const {businessName, fname, lname} = userProfileMetadata
  const {shippingAddress, paymentTerm, shippingMethod} = formData
  const {line1, zip, city, state, country} = shippingAddress
  const isScheduledCharge = !R.equals(paymentTerm, 0) && !R.isNil(paymentTerm)

  /**
   * If this is a scheduled charge:
   *    1) Handle referral
   *    2) Send order email to fulfillment
   *    3) Save order to DB
   *    4) Create shipment
   *    5) Process Xero
   *    6) Add scheduledCharge obj to DB
   *    7) Track and send notification email
   *    8) Run onScheduledChargeSuccess()
   *    9) Run runFinalCleanup()
   * Otherwise, just run onCreateCustomerSuccess()
   */
  if (isScheduledCharge) {
    // Handle referral business
    handleReferral(props, formData)

    // Save order to DB
    const customerInfo = {
      email,
      name,
      businessName,
      phone,
    }
    const shipping = {
      address_line1: line1,
      address_zip: zip,
      address_city: city,
      address_state: state,
      address_country: country,
    }
    const orderObj = createOrder(productDetails, cartItems, customerInfo, shipping, shippingMethod)
    saveOrder(orderObj)

    // Create shipment
    createShippingLabels(props, formData, orderObj)

    // Process Xero
    processXero$$(props, formData, orderObj).subscribe(
      invoiceObj => {
        // Create the scheduled charge obj and save to DB
        const {InvoiceID: invoiceId, AmountDue: amountDue, CurrencyRate: currencyRate} = invoiceObj

        // NOTE: On dev env, scheduled charge will be set to 1 sec later
        const chargeDate = __ENV__ === 'production' ?
          moment().add(parseInt(paymentTerm), 'days').valueOf().toString() :
          moment().add(1, 'seconds').valueOf().toString()
        const amount = Math.round(parseFloat(amountDue) * 100)

        const scheduledChargePayload = {
          email,
          customerId,
          chargeOn: chargeDate,
          chargeAttempted: false,
          charged: false,
          invoiceId,
          amount,
          currency,
          currencyRate: parseFloat(currencyRate),
        }
        // In dev env, this will use test_scheduled_charges table
        createScheduledCharge(scheduledChargePayload)
          .then(res => {
            console.log('Saved scheduled charge successfully', res)

            // Send email to notify
            const fromEmail = {email: SUPPORT_EMAIL}
            const toEmailArray = R.map(thisEmail => { return {email: thisEmail}})(ORDER_EMAILS)
            const subject = `[PRO CHARGE SCHEDULED] ${name} (${email})`
            const content = `Pro charge successfully scheduled for ${name} (${email}) in the amount of ${amount} (${currency.toUpperCase()})`
            const payload = {
              toEmailArray,
              fromEmail,
              subject,
              content
            }
            sendOrderEmail(payload)
          })
          .catch(err => {
            console.log('Something went wrong while saving scheduled charge', err)
            handleStripeError({message: 'Something went wrong while saving scheduled charge. Please try again.'})
          })
      },
      err => console.log('Something went wrong while processing Xero', err)
    )

    // handle post scheduled charge clean up
    onScheduledChargeSuccess(rootState, customerObj)
  } else {
    // NOT a scheduled charge
    // handle post create customer clean up
    onCreateCustomerSuccess(isPos, rootState, customerObj)
  }

  // Re-enable the button, show success icon, disable page loading
  runFinalCleanup(props)
}


/* --- EXPORTED FUNCTIONS --- */

/**
 * STRIPE
 */

export const handleStripeError = (err) => {
  console.log('handleStripeError', err)
  if (!R.isNil(err.message)) {
    changeState(OUTCOME_MESSAGE_ID, {msg: err.message, type: 'error', visible: true})
    hidePageLoading()
    changeState(PAY_BUTTON_ID, {disabled: false})
  } else {
    changeState(OUTCOME_MESSAGE_ID, {msg: 'Something went wrong. Please try again or contact support.', type: 'error', visible: true})
    hidePageLoading()
    changeState(PAY_BUTTON_ID, {disabled: false})
  }
}

export const handleStripeOutcome = (result, props = {}, formData = {}) => {
  changeState(OUTCOME_MESSAGE_ID, {visible: false})

  const {userProfile, updateBilling} = props
  const {paymentTerm} = formData
  const isPro = !R.isNil(userProfile)
  const hasPaymentTerm = paymentTerm !== 0

  if (result.token) {
    // First check if we're updating billing
    if (updateBilling) {
      console.log('Updating billing')
      handleCreateCustomerStripeTokenSuccess(result.token, props, formData)
    } else {
      // Then check if we're charging for retail or pro
      if (isPro) {
        console.log('Charging pro')
        if (hasPaymentTerm) {
          // Charge later
          handleCreateCustomerStripeTokenSuccess(result.token, props, formData)
        } else {
          // Charge now
          handleProStripeTokenSuccess(result.token, props, formData)
        }
      } else {
        console.log('Charging retail')
        handleRetailStripeTokenSuccess(result.token, props, formData)
      }
    }
  } else if (result.error) {
    handleStripeError(result.error)
  }
}

/**
 * CHARGE
 */

export const charge = (props, formData, card) => {
  const {stripe} = props
  const {email, billingAddress, shippingAddress, phone, shippingMethod} = formData
  const {
    name: billingName,
    line1: billingLine1,
    city: billingCity,
    state: billingState,
    zip: billingZip,
    country: billingCountry,
  } = billingAddress
  const {
    name: shippingName,
    line1: shippingLine1,
    city: shippingCity,
    state: shippingState,
    zip: shippingZip,
    country: shippingCountry,
  } = shippingAddress
  const extraDetails = {
    name: R.defaultTo(shippingName, billingName),
    address_city: R.defaultTo(shippingCity, billingCity),
    address_country: R.defaultTo(shippingCountry, billingCountry),
    address_line1: R.defaultTo(shippingLine1, billingLine1),
    address_state: R.defaultTo(shippingState, billingState),
    address_zip: R.defaultTo(shippingZip, billingCity),
  }
  stripe.createToken(card, extraDetails)
    .then(result => handleStripeOutcome(result, props, formData))
}

/* DEPRECATED: No need - just use charge with prefilled fields
export const chargeExistingPro = (props, formData) => {
  const {customer, userProfile, locale, coupon, shippingDetails, countryCode} = props
  const {couponId = 'None'} = coupon
  const cartItemsWithDetail = getCartItemsWithDetail(props)
  const shippingOptions = getShippingOptions(props)
  const {currency} = locale
  const {shippingMethod} = formData
  const shippingRate = getShippingRate(props, shippingMethod)
  const {shipping, id: customerId} = customer
  const {name, phone} = shipping
  const {metadata: userProfileMetadata} = userProfile
  const {businessName} = userProfileMetadata
  const total = getTotal(props, formData)

  const stripeMetadata = {
    name,
    business_name: businessName,
    phone,
    couponId,
    shipping_method: getShippingMethodTitle(shippingOptions, shippingMethod),
    shipping_price: shippingRate / 100,
    products: getProductContent(cartItemsWithDetail),
    quantity: getTotalQuantity(cartItemsWithDetail),
    professional_free_sample: false,
  }
  const payload = {
    customerId,
    amount: total,
    currency: currency,
    metadata: stripeMetadata,
  }
  console.log('Charging existing pro')
  charge$$(payload)
    .subscribe(
      chargeData => {
        // console.log('Charge successful!', chargeData)
        handleProChargeSuccess(props, formData, chargeData)
      },
      err => {
        console.log('Something went wrong while charging the order', err)
        handleStripeError(err)
      }
    )
}
*/

/**
 * UPDATE BILLING INFO
 */

export const updateBillingInfo = (props, formData, card) => {
  const {stripe} = props
  const {email, billingAddress, shippingAddress, phone, shippingMethod} = formData
  const {
    name: billingName,
    line1: billingLine1,
    city: billingCity,
    state: billingState,
    zip: billingZip,
    country: billingCountry,
  } = billingAddress
  const {
    name: shippingName,
    line1: shippingLine1,
    city: shippingCity,
    state: shippingState,
    zip: shippingZip,
    country: shippingCountry,
  } = shippingAddress
  const extraDetails = {
    name: R.defaultTo(shippingName, billingName),
    address_city: R.defaultTo(shippingCity, billingCity),
    address_country: R.defaultTo(shippingCountry, billingCountry),
    address_line1: R.defaultTo(shippingLine1, billingLine1),
    address_state: R.defaultTo(shippingState, billingState),
    address_zip: R.defaultTo(shippingZip, billingCity),
  }
  stripe.createToken(card, extraDetails)
    .then(result => handleStripeOutcome(result, props, formData))
}

/**
 * PROCESS SAMPLE
 */
export const processSample = (props, formData) => {
  /**
   * ONLY FOR POS (website has a different flow directly from pro signup)
   *    1) Send order email
   *    2) Save to MailChimp
   *    3) Save order to DB
   *    4) Create shipment
   *    5) Process Xero
   * NOTE: This function will handle both processSample and chargeManual since
   *       they are exactly same as chargeManual flow EXCEPT FOR:
   *          1) CHARGING 1 cent in Xero
   *          2) Tracking, order email, and MailChimp is different
   */
  const {email, shippingAddress, phone, shippingMethod, salesTax} = formData
  const {isPos, coupon, rootState, locale, userProfile, productDetails, cartItems, track, onSampleSuccess} = props
  const cartItemsWithDetail = getCartItemsWithDetail(props)
  const {currency} = locale
  const {metadata: userProfileMetadata} = userProfile
  const {
    fname,
    lname,
    businessName,
    professionalType,
    quantityEst,
    trainer,
  } = userProfileMetadata
  const {
    name,
    line1: address_line1,
    city: address_city,
    state: address_state,
    country: address_country,
    zip: address_zip,
  } = shippingAddress
  const isFreeSample = checkIsFreeSample(props)
  const {couponId = 'None'} = coupon
  const total = getTotal(props, formData)
  const shippingRate = getShippingRate(props, shippingMethod)

  // send order email to fulfillment using Sendgrid
  const fromEmail = {email: SUPPORT_EMAIL}
  const toEmailArray = R.map(eachEmail => { return {email: eachEmail}})(ORDER_EMAILS)
  const productsContent = getProductContent(cartItemsWithDetail)
  const otherData = {
    name,
    professionalType,
    quantityEst,
    businessName,
    trainer,
    address_line1,
    address_zip,
    address_city,
    address_country,
    address_state,
    phone,
    shipping_method: shippingMethod,
    shipping_price: shippingRate / 100,
    sales_tax: salesTax / 100,
    couponId,
    products: productsContent,
    quantity: 1,
    professional_free_sample: true,
  }
  const orderDetails = R.merge({
    email,
    amount: total / 100,
    currency,
    created: moment().format('MMM Do YYYY, h:mm:ss a'),
  }, otherData)
  const orderDetailsPairs = R.toPairs(orderDetails) // [['key', 'value'], ['key', 'value'], ...]
  const content = R.reduce((prev, curr) => prev + `${R.head(curr)}: ${R.last(curr)}\n\n`, '')(orderDetailsPairs)

  if (isFreeSample) {
    // Free sample case
    const subject = `[ORDER - FREE SAMPLE FROM POS] order for ${productsContent} from ${email}`

    const orderEmailPayload = {
      toEmailArray: toEmailArray,
      fromEmail,
      subject: subject,
      content: content
    }
    sendOrderEmail(orderEmailPayload)
  } else {
    // Manual charge case
    const subject = `[ORDER - MANUAL CHARGE] order for ${productsContent} from ${email}`

    const orderEmailPayload = {
      toEmailArray: toEmailArray,
      fromEmail,
      subject: subject,
      content: content
    }
    sendOrderEmail(orderEmailPayload)
  }

  // Save order
  const customerInfo = {
    email,
    name,
    businessName,
    phone,
  }
  const shipping = {
    address_line1,
    address_zip,
    address_city,
    address_state,
    address_country,
  }
  const orderObj = createOrder(productDetails, cartItems, customerInfo, shipping, shippingMethod)
  saveOrder(orderObj)

  // Create shipment
  createShippingLabels(props, formData, orderObj)

  // Process Xero
  processXero$$(props, formData, orderObj).subscribe(
    invoiceObj => console.log('Processing Xero successful'),
    err => console.log('Something went wrong while processing Xero', err)
  )

  // Handle post sample clean up
  onSampleSuccess(rootState)

  // Re-enable the button, show success icon, disable page loading
  runFinalCleanup(props)
}

/**
 * SCHEDULED CHARGE (i.e. net 30)
 */
export const chargeLater = (props, formData, card) => {
  /**
   * ONLY FOR POS
   */
  // Create Stripe customer but don't charge
  const {stripe} = props
  const {email, billingAddress, shippingAddress, phone, shippingMethod} = formData
  const {
    name: billingName,
    line1: billingLine1,
    city: billingCity,
    state: billingState,
    zip: billingZip,
    country: billingCountry,
  } = billingAddress
  const {
    name: shippingName,
    line1: shippingLine1,
    city: shippingCity,
    state: shippingState,
    zip: shippingZip,
    country: shippingCountry,
  } = shippingAddress
  const extraDetails = {
    name: R.defaultTo(shippingName, billingName),
    address_city: R.defaultTo(shippingCity, billingCity),
    address_country: R.defaultTo(shippingCountry, billingCountry),
    address_line1: R.defaultTo(shippingLine1, billingLine1),
    address_state: R.defaultTo(shippingState, billingState),
    address_zip: R.defaultTo(shippingZip, billingCity),
  }
  stripe.createToken(card, extraDetails)
    .then(result => handleStripeOutcome(result, props, formData))
}

/**
 * CHARGE MANUALLY
 */
export const chargeManual = (props, formData) => {
  /**
   * ONLY FOR POS
   *    1) Send order email
   *    2) Save to MailChimp
   *    3) Save order to DB
   *    4) Create shipment
   *    5) Process Xero
   * NOTE: Exactly same as sample flow EXCEPT FOR processXero() where the
   * price is NOT changed to 1c
   *    1) CHARGING 1 cent in Xero
   *    2) Tracking, order email, and MailChimp is different
   */
  processSample(props, formData)
}
