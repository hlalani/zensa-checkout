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
} from '../state/constants'
import {
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
  createShipment,
  processXero,
  resetAllFields,
  runFinalCleanup,
} from './utils'
import {createCustomerAndCharge$$, charge$$, createCustomer$$} from '../stripe/observables'
import {subscribeNewMember$$, deleteMember$$} from '../mailchimp/observables'
import {createOrder} from '../orders/core'
import {saveOrder} from '../orders/graphql'
import {createScheduledCharge} from '../scheduled-charges/graphql'

/**
 * 1) If updateBilling === true, run updateBilling().
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
  const {email, billingAddress, shippingAddress, phone, shippingMethod} = formData
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
      handleRetailChargeSuccess(props, chargeData)
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

function handleRetailChargeSuccess(props, chargeData) {
  const {receipt_email: email, metadata: chargeMetadata, amount} = chargeData
  const {name, phone, business_name, line1, postal_code, city, state, country, shipping_method} = chargeMetadata
  const {onChargeSuccess, track, locale, cartItems, productDetails, addToEmailList = true, rootState} = props
  const cartItemsWithDetail = getCartItemsWithDetail(props)
  const {currency} = locale

  // track purchase
  track.purchase(email, currency, cartItemsWithDetail)

  // subscribe the user to the email list (MailChimp) if they opted in
  if (addToEmailList) {
    const mailchimpPayload = {
      email_address: email,
      status: 'subscribed',
    }
    subscribeNewMember$$(MAILCHIMP_LOYALTY_LIST_ID, payload).subscribe(
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
  // createShipment()

  /**
   * Xero:
   *    1) Create customer (or update)
   *    2) Create an invoice
   *    3) Mark it paid if payment is immediate
   */
  // processXero()

  // // Reset all fields
  // resetAllFields(props)

  // Handle post charge clean up
  onChargeSuccess(rootState, chargeData)

  // Re-enable the button, show success icon, disable page loading
  runFinalCleanup()
}

/**
 * PRO
 */

function handleProStripeTokenSuccess(token, props, formData) {
  const {locale, coupon, userProfile, shippingDetails, countryCode} = props
  const {couponId = 'None'} = coupon
  const cartItemsWithDetail = getCartItemsWithDetail(props)
  const shippingOptions = getShippingOptions(props)
  const {metadata: userProfileMetadata} = userProfile
  const {businessName} = userProfileMetadata
  const {currency} = locale
  const {email, billingAddress, shippingAddress, phone, shippingMethod} = formData
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
      handleProChargeSuccess(props, chargeData)
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

function handleProChargeSuccess(props, chargeData) {
  const {receipt_email: email, metadata: chargeMetadata, amount} = chargeData
  const {name, phone, business_name, line1, postal_code, city, state, country, shipping_method} = chargeMetadata
  const {onChargeSuccess, track, locale, cartItems, productDetails, userProfile, customer, addToEmailList = true, rootState} = props
  const cartItemsWithDetail = getCartItemsWithDetail(props)
  const {currency} = locale

  // Track purchase
  track.professionalPurchase(email, currency, cartItemsWithDetail)

  // Handle referral business
  handleReferral(props)

  // Subscribe the user to the email list (MailChimp) if they opted in
  // Don't run if customer already exists (since they're already in the buyer list)
  if (addToEmailList && R.isNil(customer)) {
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
        return deleteMember$$(MAILCHIMP_PROFESSIONAL_FREE_SAMPLE_LIST_ID, email)
      })
      .flatMap(res => {
        console.log('MailChimp remove from professional free sample list successful! ', res)
        return deleteMember$$(MAILCHIMP_LOYALTY_LIST_ID, email)
      })
      .subscribe(
        res => console.log('MailChimp remove from loyalty list successful! ', res),
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
  // createShipment()

  /**
   * Xero:
   *    1) Create customer (or update)
   *    2) Create an invoice
   *    3) Mark it paid if payment is immediate
   */
  // processXero()

  // // Reset all fields
  // resetAllFields(props)

  // Handle post charge clean up
  onChargeSuccess(rootState, chargeData)

  // Re-enable the button, show success icon, disable page loading
  runFinalCleanup()
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
  const {userProfile, track, onCreateCustomerSuccess} = props
  const {metadata: customerMetadata, id: customerId} = customerObj
  const {name} = customerMetadata
  const {email, metadata: userProfileMetadata} = userProfile
  const {businessName, fname, lname} = userProfileMetadata
  const {new: isNewCustomer} = customerMetadata
  const {paymentTerm} = formData
  const isScheduledCharge = !R.equals(paymentTerm, 0) && !R.isNil(paymentTerm)

  // Track and send email if it's a new customer
  if (isNewCustomer && !isScheduledCharge) {
    // track
    track.professionalAddBilling()

    // send email to notify of signup for possible follow up
    const fromEmail = {email: SUPPORT_EMAIL}
    const toEmailArray = R.map(email => { return {email}})(PROFESSIONAL_ADD_BILLING_NOTIFICATION_EMAILS)
    const subject = `[PROFESSIONAL ADDED BILLING INFO] ${name} (${email})`
    const content = `${name} (${email}) just added billing information in Zensa Professional portal`
    const payload = {
      toEmailArray,
      fromEmail,
      subject,
      content
    }

    sendEmail$$(payload).subscribe(
      res => console.log('Email successfully sent', res),
      err => console.log('Something went wrong while sending professional add billing notification email: ', err)
    )
  }

  /**
   * If this is a scheduled charge:
   *    1) Track and send notification email
   *    2) Add scheduledCharge obj to DB
   *    3) Run onScheduledChargeSuccess()
   * Otherwise, just run onCreateCustomerSuccess()
   */
  if (isScheduledCharge) {
    // Create the scheduled charge obj and save to DB
    const chargeDate = moment().add(parseInt(paymentTerm), 'days').valueOf().toString()
    const scheduledChargePayload = {
      email,
      customerId,
      chargeOn: chargeDate,
      chargeAttempted: false,
      charged: false,
    }
    createScheduledCharge(scheduledChargePayload)
      .then(res => {
        console.log('Saved scheduled charge successfully', res)

        // track
        track.professionalChargeScheduled()

        // Send email to notify
        const fromEmail = {email: SUPPORT_EMAIL}
        const toEmailArray = R.map(thisEmail => { return {email: thisEmail}})(ORDER_EMAILS)
        const subject = `[PRO CHARGE SCHEDULED] ${name} (${email})`
        const content = `Pro charge successfully scheduled for ${name} (${email})`
        const payload = {
          toEmailArray,
          fromEmail,
          subject,
          content
        }
        sendEmail$$(payload).subscribe(
          res => console.log('Email successfully sent', res),
          err => console.log('Something went wrong while sending pro charge scheduled email: ', err)
        )
      })
      .catch(err => {
        console.log('Something went wrong while saving scheduled charge', err)
        handleStripeError(err)
      })

    // handle post scheduled charge clean up
    onScheduledChargeSuccess(customerObj)
  } else {
    // handle post create customer clean up
    onCreateCustomerSuccess(customerObj)
  }

  // Re-enable the button, show success icon, disable page loading
  runFinalCleanup()
}


/* --- EXPORTED FUNCTIONS --- */

/**
 * STRIPE
 */

export const handleStripeError = (err) => {
  console.log('handleStripeError', err)
  if (!R.isNil(err.message)) {
    changeState(OUTCOME_MESSAGE_ID, {msg: err.message, type: 'error', visible: true})
  } else {
    changeState(OUTCOME_MESSAGE_ID, {msg: 'Something went wrong. Please try again or contact support.', type: 'error', visible: true})
  }
}

export const handleStripeOutcome = (result, props = {}, formData) => {
  changeState(OUTCOME_MESSAGE_ID, {visible: false})

  const {userProfile = null, updateBilling = false} = props
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
          handleProWithPaymentTermStripeTokenSuccess(result.token, props, formData)
        } else {
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
        handleProChargeSuccess(props, chargeData)
      },
      err => {
        console.log('Something went wrong while charging the order', err)
        handleStripeError(err)
      }
    )
}

/**
 * UPDATE BILLING
 */

export const updateBilling = (props, formData, card) => {
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
   * Save to shipping list, create shipment, process Xero
   * NOTE: Exactly same as chargeManual flow EXCEPT FOR CHARGING 1 cent in Xero
   */
  const {email, shippingAddress, phone, shippingMethod} = formData
  const {name, line1, postal_code, city, state, country} = shippingAddress
  const {userProfile, productDetails, cartItems} = props
  const {business_name} = userProfile

  // Save order
  const customerInfo = {
    email,
    name,
    businessName: business_name,
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
  createShipment()

  // Process Xero
  processXero()
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
   * Save to shipping list, create shipment and process Xero
   * NOTE: Exactly same as sample flow EXCEPT FOR process Xero
   */
  const {email, shippingAddress, phone, shippingMethod} = formData
  const {name, line1, postal_code, city, state, country} = shippingAddress
  const {userProfile, productDetails, cartItems} = props
  const {business_name} = userProfile

  // Save order
  const customerInfo = {
    email,
    name,
    businessName: business_name,
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
  createShipment()

  // Process Xero
  processXero()
}
