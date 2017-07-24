import R from 'ramda'
import Rx from 'rx-lite'
import axios from 'axios'
import moment from 'moment'
import {
  REFERRAL_CREDIT_RATE,
  NUMBING_CREAM_30G_SKU,
  RETAIL_VOLUME_DISCOUNT_TABLE,
  REFERRED_CREDIT_RATE,
  SAMPLE_PACK_SKU,
  XERO_ACCOUNT_CODES,
  XERO_USD_TO_CAD_EXCHANGE_RATE,
  GRAMS_TO_POUNDS,
} from '../global/constants'
import {changeState} from '../state/events'
import {getElemState, resetState} from '../state/core'
import {
  EMAIL_FIELD_ID,
  SHIPPING_ADDRESS_NAME_FIELD_ID,
  SHIPPING_ADDRESS_LINE1_FIELD_ID,
  SHIPPING_ADDRESS_ZIP_FIELD_ID,
  SHIPPING_ADDRESS_CITY_FIELD_ID,
  SHIPPING_ADDRESS_STATE_FIELD_ID,
  SHIPPING_ADDRESS_COUNTRY_FIELD_ID,
  BILLING_ADDRESS_NAME_FIELD_ID,
  BILLING_ADDRESS_LINE1_FIELD_ID,
  BILLING_ADDRESS_ZIP_FIELD_ID,
  BILLING_ADDRESS_CITY_FIELD_ID,
  BILLING_ADDRESS_STATE_FIELD_ID,
  BILLING_ADDRESS_COUNTRY_FIELD_ID,
  PHONE_FIELD_ID,
  ADDRESS_TOGGLE_ID,
  SHIPPING_METHOD_ID,
  PAY_BUTTON_ID,
  PAYMENT_TERM_FIELD_ID,
  PAYMENT_METHOD_ID,
  SAME_SHIPPING_BILLING_CHECKBOX_ID,
  SALES_TAX_ID,
} from '../state/constants'
import {
  getProfessionalUserByReferralCodeFromDB$$,
  updateProfessionalUserReferralCreditInDB$$,
  updateProfessionalUserInDB$$,
} from '../professional-users/observables'
import {
  convertToXeroLineItems,
  convertToXeroName,
} from '../xero/core'
import {
  createOrUpdateXeroContact$$,
  createXeroInvoice$$,
  createXeroPayment$$,
  updateXeroInvoice$$,
} from '../xero/observables'
import {createShippingLabels$$} from '../shipment/observables'
import {getShippingBoxes$$} from '../box-packing/observables'
import {getLineItemsWithDimensions} from '../box-packing/core'
import {sendEmail$$} from '../sendgrid/observables'
import {hidePageLoading, showPageLoadingSuccess, hidePageLoadingSuccess} from '../page-loading/core'
import {getLineItems} from '../orders/core'
import {convertToTaxLineItems} from '../sales-tax/core'
import {calcSalesTax$$} from '../sales-tax/observables'
import availableCountries from '../locale/available-countries.json'

/**
 * GENERAL UTILITY FUNCTIONS
 */

/**
 * between :: [Integer, Integer] -> Integer -> Boolean
 * Find out if a given number falls within an two numbers in an array
 *    i.e. between([10, 24], 7) -> false
 *    i.e. between([10, 24], 11) -> true
 */
const between = R.curry((arr, num) => {
  return R.head(arr) <= num && R.last(arr) >= num
})

/**
 * indexOfRange :: [Integer] -> Integer -> Integer
 * Get the index of where the given number falls within a given array of integers
 *    i.e. indexOfRange([10, 24, 96], 8) -> 0
 *    i.e. indexOfRange([10, 24, 96], 20) -> 1
 */
const indexOfRange = R.curry((arr, num) => {
  const ranges = R.compose(R.append([R.last(arr), Infinity]), R.map(eachNum => {
    const i = R.indexOf(eachNum, arr)
    return [R.when(R.isNil, () => 0)(R.prop(i - 1, arr)), eachNum - 1]
  }))(arr) // [[1, 9], [10, 23], [24, 95], [96, Infinity]]
  const whichRange = R.map(range => between(range, num))(ranges) // [true, false, false, false]
  return R.indexOf(true, whichRange)
})


/**
 * UTILITY FUNCTIONS
 */

function checkQualifiesForSigningBonus(props) {
  const {userProfile} = props
  const isPro = checkIsPro(props)
  if (!isPro) { return null }

  const {created_at} = userProfile
  const today = moment()
  const signupDate = moment(created_at)
  const signingBonusAvailableUntil = signupDate.add(26, 'days')
  return today.diff(signingBonusAvailableUntil, 'days') < 0
}

function generateLineItems(productDetails, cartItems) {
  const allLineItems = R.compose(R.unnest, R.map(product => {
    // Multiply each lineItem quantity by the order quantity
    const {sku, lineItems} = product
    const multiplyQuantityBy = R.prop(sku, cartItems)
    if (R.isNil(lineItems)) {
      const thisCartItemQuantity = R.prop(sku, cartItems)
      return [
        {sku, quantity: thisCartItemQuantity}
      ]
    } else {
      const quantityAdjustedLineItems = R.map(lineItem => {
        const {sku, quantity} = lineItem
        return {sku, quantity: quantity * multiplyQuantityBy}
      })(lineItems)
      return quantityAdjustedLineItems
    }
  }), R.filter(product => {
    // First filter for products that are in cartItems
    const cartItemSkus = R.keys(cartItems)
    const productSku = R.prop('sku', product)
    return R.indexOf(productSku, cartItemSkus) !== -1
  }))(productDetails)
  const uniqItemSkus = R.compose(R.pluck('sku'), R.uniqBy(R.prop('sku')))(allLineItems)
  return R.map(sku => {
    const quantity = R.compose(R.sum, R.pluck('quantity'), R.filter(item => R.prop('sku', item) === sku))(allLineItems)
    return {
      sku,
      quantity
    }
  })(uniqItemSkus)
}

function getProShippingRate(ratesByWeight, productDetails, cartItems) {
  const lineItems = generateLineItems(productDetails, cartItems)
  const totalWeight = R.compose(R.sum, R.map(lineItem => {
    const {sku, quantity} = lineItem
    const thisProduct = R.find(R.propEq('sku', sku))(productDetails)
    const {weight} = thisProduct
    return parseFloat(weight) * quantity
  }))(lineItems)
  const totalWeightInt = Math.round(totalWeight)
  if (totalWeightInt < 1) {
    return R.prop('1', ratesByWeight)
  } else if (totalWeightInt >= 1 && totalWeightInt <= 12) {
    return R.prop(totalWeightInt, ratesByWeight)
  } else {
    // If greater than 12lbs in rounded weight
    return R.prop('12', ratesByWeight)
  }
}

function addReferralCredit(userProfile, referralTotal, referrerEmail) {
  // add referral credit to referrer's account if any
  const email = R.prop('email', userProfile)
  const businessName = R.path(['metadata', 'businessName'], userProfile)
  const referralCredit = referralTotal * REFERRAL_CREDIT_RATE / 100
  const payload = {
    metadata: {
      referral: {
        credit: referralCredit,
        referred_to: [
          {email, businessName, initialPurchase: referralTotal}
        ]
      }
    }
  }
  updateProfessionalUserReferralCreditInDB$$(referrerEmail, payload).subscribe(
    dbRes => console.log('updateProfessionalUserReferralCreditInDB$$ successful', dbRes),
    err => console.log('Something went wrong while running updateProfessionalUserReferralCreditInDB$$', err)
  )
}

function parseGoogleAddressComponents(addressComponents, type) {
  const addressComponent = R.filter(R.where({types: R.contains(type)}))(addressComponents)
  return R.isEmpty(addressComponent) ? 'Unknown' : R.compose(R.prop('short_name'), R.head)(addressComponent)
}

function getProductSubtotals(locale, productDetails, cartItems) {
  const {currency} = locale
  return R.mapObjIndexed((cartItem, sku) => {
    const price = R.compose(R.path(['price', R.toLower(currency)]), R.head, R.filter(R.whereEq({sku})))(productDetails)
    const quantity = cartItem
    return price * quantity
  }, cartItems) // {627843518181: 11000, 627843518181: 16500, ...}
}

function getCouponDiscount(cartItemsWithDetail, subtotal, coupon) {
  if (R.isNil(coupon) || R.isEmpty(coupon)) { return 0 }

  const {discount, type, applyTo} = coupon
  if (type === 'dollar') {
    return discount
  } else {
    const discountRate = discount / 100
    if (applyTo === 'first') {
      const firstItemPrice = R.isEmpty(cartItemsWithDetail) ? 0 : R.compose(R.prop('price'), R.head)(cartItemsWithDetail)
      return firstItemPrice * discountRate
    } else {
      return subtotal * discountRate
    }
  }
}

function getStateCode(stateName) {
  return R.prop(stateName, stateList)
}

/* --- EXPORTED FUNCTIONS --- */

export const checkIsFreeSample = (props) => {
  const {cartItems} = props
  return R.compose(R.contains(SAMPLE_PACK_SKU), R.keys)(cartItems)
}

export const checkIsPro = (props) => {
  const {userProfile} = props
  return !R.isNil(userProfile)
}
export const checkIsExistingCustomer = (props) => {
  const {customer} = props
  return !R.isNil(customer)
}

// getCartItemsWithDetail :: {*} -> {*} -> [{*}]
export const getCartItemsWithDetail = (props) => {
  /*
    input {
      123: 1,
      ...
    }
    returns [
      {
        sku: '123',
        name: 'Zensa Numbing Cream',
        quantity: 1,
        price: 5500,
        thumbUrl: 'http://www.zensaskincare.com/images/zensa-topical-anaesthetic-30g-thumb.jpg'
      },
      ...
    ]
  */

  const {locale, cartItems, productDetails, userProfile = null} = props
  const {currency} = locale
  const isPro = checkIsPro(props)

  if (R.isNil(cartItems)) { return [] }

  const cartItemsWithDetail = R.keys(cartItems).reduce((prev, cartItemKey) => {
    const sku = cartItemKey
    const quantity = cartItems[cartItemKey]
    const thisProduct = R.compose(R.head, R.filter(product => product.sku === sku))(productDetails) || {}
    const {name, thumbUrl} = thisProduct
    const price = R.path(['price', currency], thisProduct)
    return R.append({sku, name, quantity, price, thumbUrl}, prev)
  }, [])

  if (!isPro) {
    // If userProfile is null, then it means this is retail checkout and signing bonus doesn't exist at all
    return cartItemsWithDetail
  } else {
    const qualifiesForSigningBonus = checkQualifiesForSigningBonus(props)

    if (qualifiesForSigningBonus) {
      // This would be pro checkout with signing bonus
      // If the buyer qualifies, check to see if s/he has numbing cream in the cart
      const hasNumbingCreamInCart = R.find(R.propEq('sku', NUMBING_CREAM_30G_SKU))(cartItemsWithDetail) !== undefined

      if (hasNumbingCreamInCart) {
        // If the buyer has numbing cream in the cart, just add quantity 1 to numbing cream
        return R.map(cartItem => {
          return R.prop('sku', cartItem) === NUMBING_CREAM_30G_SKU ? R.merge(cartItem, {quantity: cartItem.quantity + 1}) : cartItem
        })(cartItemsWithDetail)
      } else {
        // If the buyer does NOT have numbing cream in the cart, add numbing cream
        const numbingCreamProductDetails = R.find(R.propEq('sku', NUMBING_CREAM_30G_SKU))(productDetails)
        const {sku, name, thumbUrl, price = {}} = numbingCreamProductDetails || {}

        return R.append({
          sku,
          name,
          quantity: 1,
          price: R.prop(currency, price),
          thumbUrl,
        })(cartItemsWithDetail)
      }
    } else {
      // This would be pro checkout without signing bonus
      return cartItemsWithDetail
    }
  }
}

export const getProductContent = (cartItemsWithDetail) => {
  const productNameArray = R.pluck('name', cartItemsWithDetail)
  const productQuantityArray = R.pluck('quantity', cartItemsWithDetail)
  const productQuantityPairs = R.zip(productNameArray, productQuantityArray) // [['numbing cream', 1], ...]
  return R.reduce((prev, curr) => prev + ((prev !== '') ? ' + ' : '') + `${R.last(curr)} of ${R.head(curr)}`, '')(productQuantityPairs)
}

export const getTotalQuantity = (cartItemsWithDetail) => {
  const productQuantities = R.compose(R.unnest, R.pluck('quantity'))(cartItemsWithDetail) // [1, 1, ...]
  return R.sum(productQuantities)
}

export const getShippingMethodTitle = (shippingDetails, shippingMethod) => {
  return R.compose(R.prop('title'), R.find(R.propEq('name', shippingMethod)))(shippingDetails)
}

export const getSubtotal = (props) => {
  const {locale, productDetails, cartItems} = props
  const productSubtotals = getProductSubtotals(locale, productDetails, cartItems)
  return R.compose(R.sum, R.values)(productSubtotals)
}

// Returns discount per unit in dollars
// getProfessionalUnitDiscount :: {*} -> Integer -> Integer -> Integer
export const getProfessionalUnitDiscount = (professionalDiscountMap, originalPrice, quantity) => {
  if (R.isNil(professionalDiscountMap)) { return 0 }
  const prices = R.pluck('price', professionalDiscountMap) // [2500, 2000, 1800]
  const quantities = R.pluck('quantity', professionalDiscountMap) // [10, 24, 96]
  const rangeIndex = indexOfRange(quantities, quantity) // 1
  return rangeIndex <= 0 ? 0 : (originalPrice - R.prop(rangeIndex - 1, prices)) // 3000 (i.e. 5500 - 2500)
}

export const getProVolumeDiscounts = (currency, productDetails, cartItemsWithDetail) => {
  if (R.isEmpty(productDetails) || R.isEmpty(cartItemsWithDetail)) { return {} }

  const discounts = R.map(cartItem => {
    const product = R.find(R.propEq('sku', cartItem.sku))(productDetails)
    const originalPrice = R.path(['price', currency])(product)
    const professionalDiscountMap = R.path(['wholesalePriceMap', currency])(product)
    return getProfessionalUnitDiscount(professionalDiscountMap, originalPrice, cartItem.quantity) * cartItem.quantity
  })(cartItemsWithDetail)

  return R.reduce((prev, curr) => {
    const i = R.indexOf(curr, cartItemsWithDetail)
    return R.merge(prev, {[curr.sku]: R.prop(i, discounts)})
  }, {})(cartItemsWithDetail) // {sku: discount, sku2: discount2, ...}
}

export const getProVolumeDiscount = (proVolumeDiscounts) => {
  if (R.isEmpty(proVolumeDiscounts)) { return 0 }
  return R.compose(R.sum, R.values)(proVolumeDiscounts)
}

// getRetailDiscountRate :: Integer -> Integer
export const getRetailDiscountRate = (quantity) => {
  return quantity <= 3 ? R.prop(quantity, RETAIL_VOLUME_DISCOUNT_TABLE) : R.compose(R.last, R.values)(RETAIL_VOLUME_DISCOUNT_TABLE) || 0
}

export const getRetailVolumeDiscount = (cartItems, productSubtotals) => {
  const discounts = R.mapObjIndexed((quantity, sku) => {
    const subtotalForSku = R.prop(sku, productSubtotals)
    const discountForSku = subtotalForSku * (getRetailDiscountRate(quantity) / 100)
    return discountForSku
  })(cartItems) // {627843518181: 11000 * 10%, 627843518181: 16500 * 15%, ...}
  return R.compose(R.sum, R.values)(discounts)
}

export const getDiscount = (props) => {
  const {userProfile = null, cartItems, locale, productDetails, coupon} = props
  const {currency} = locale
  const isPro = checkIsPro(props)
  const cartItemsWithDetail = getCartItemsWithDetail(props)
  const productSubtotals = getProductSubtotals(locale, productDetails, cartItems)
  const subtotal = getSubtotal(props)
  const couponDiscount = (R.isNil(coupon) || R.isEmpty(coupon)) ? 0 : getCouponDiscount(cartItemsWithDetail, subtotal, coupon)

  if (isPro) {
    const proVolumeDiscounts = getProVolumeDiscounts(currency, productDetails, cartItemsWithDetail)
    const proVolumeDiscount = getProVolumeDiscount(proVolumeDiscounts)
    return proVolumeDiscount + couponDiscount
  } else {
    const retailVolumeDiscount = getRetailVolumeDiscount(cartItems, productSubtotals)
    return retailVolumeDiscount + couponDiscount
  }
}

export const getReferralCredit = (props, subtotalAfterDiscount) => {
  /*
    There are two sides to referral credit:
    1) if you are referred by someone (referredCredit), or
    2) if you refer someone (referralCredit)
  */
  const {userProfile} = props
  const isPro = checkIsPro(props)

  if (isPro) {
    // Case #1
    const referredBySomeone = R.compose(R.not, R.either(R.isEmpty, R.isNil), R.prop('referred_by'))(userProfile)
    const referredCredit = referredBySomeone ? REFERRED_CREDIT_RATE / 100 * subtotalAfterDiscount : 0

    // Case #2
    const referralCredit = R.path(['metadata', 'referral', 'credit'])(userProfile) || 0

    return referredCredit + referralCredit
  } else {
    return 0
  }
}

export const getShippingOptions = (props) => {
  const {isPos, userProfile, shippingDetails, countryCode} = props
  const isPro = checkIsPro(props)
  const isFreeSample = checkIsFreeSample(props)
  const isInternational = countryCode !== 'US' && countryCode !== 'CA'
  if (isFreeSample) {
    return R.filter(option => R.prop('freeSample', option), shippingDetails)
  }
  if (isPro) {
    const proShippingOptions = R.filter(option => {
      const nameContainsIntl = R.compose(R.contains('intl'), R.toLower, R.prop('name'))(option)
      return isInternational ? R.prop('professional', option) && nameContainsIntl : R.prop('professional', option) && !nameContainsIntl
    }, shippingDetails)
    if (isPos) {
      return proShippingOptions
    } else {
      return R.reject(R.propEq('pos', true))(proShippingOptions)
    }
  } else {
    return R.filter(option => {
      const isRetailShippingOptions = !R.prop('professional', option) && !R.prop('freeSample', option)
      const nameContainsIntl = R.compose(R.contains('intl'), R.toLower, R.prop('name'))(option)
      return isInternational ? isRetailShippingOptions && nameContainsIntl : isRetailShippingOptions && !nameContainsIntl
    }, shippingDetails)
  }
}

export const getShippingRate = (props, shippingMethod) => {
  if (R.isNil(shippingMethod)) { return 0 }

  const {userProfile = null, locale, shippingDetails, productDetails, cartItems} = props
  const isPro = checkIsPro(props)
  const {currency} = locale
  const currentShippingMethodDetails = R.compose(R.head, R.filter(obj => obj.name === shippingMethod))(shippingDetails)

  if (isPro) {
    const ratesByWeight = R.path(['ratesByWeight', currency], currentShippingMethodDetails) || 0
    return getProShippingRate(ratesByWeight, productDetails, cartItems)
  } else {
    return R.path(['price', currency], currentShippingMethodDetails) || 0
  }
}

export const getTotalBeforeTax = (props, formData) => {
  const {shippingMethod} = formData
  const subtotal = getSubtotal(props)
  const shippingRate = getShippingRate(props, shippingMethod)
  const discount = getDiscount(props)
  const subtotalAfterDiscount = subtotal - discount
  const referralCredit = getReferralCredit(props, subtotalAfterDiscount)
  return subtotal + shippingRate - discount - referralCredit
}

export const getTotal = (props, formData) => {
  const {salesTax} = formData
  return getTotalBeforeTax(props, formData) + salesTax
}

export const getFullAddressFromStateValues = (addressStateValues) => {
  // Concatenate the city, country and zipcode fields and check google geocode API to get the state
  return R.reduce((prev, curr) => {
    if (prev === '') { return curr }
    return prev + ', ' + curr
  }, '')(addressStateValues)
}

export const getStateFromFullAddress$$ = (fullAddress) => {
  const encodedAddress = encodeURIComponent(fullAddress)
  return Rx.Observable.fromPromise(axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&sensor=true`))
    .map(res => {
      if (R.isEmpty(res.data.results)) { return 'Unknown' }
      const addressComponents = res.data.results[0].address_components
      const stateCode = parseGoogleAddressComponents(addressComponents, 'administrative_area_level_1')
      return stateCode
    })
}

export const getSalesTax$$ = (props, formData, shippingRate) => {
  const {shippingAddress} = formData
  const isFreeSample = checkIsFreeSample(props)
  const isPro = checkIsPro(props)
  const totalBeforeTax = getTotalBeforeTax(props, formData)
  if (totalBeforeTax === 0) { return Rx.Observable.just({amount_to_collect: 0}) }

  // const {cartItems, productDetails} = props
  // const lineItems = getLineItems(productDetails, cartItems)
  // const taxLineItems = convertToTaxLineItems(props, isFreeSample, isPro, lineItems)
  return calcSalesTax$$(shippingAddress, totalBeforeTax, shippingRate)
    .map(res => res.data)
}

export const handleReferral = (props, formData) => {
  const {userProfile, customer} = props
  const {email} = userProfile
  const total = getTotal(props, formData)
  const isExistingCustomer = checkIsExistingCustomer(props)

  if (!isExistingCustomer) {
    /**
     * If referred_by is present, then add credit to the referrer account.
     * This part only applies to initial checkout (i.e. not existing customer)
     * since credit is accrued to the referrer on initial purchase ONLY.
     */
    const referralTotal = total // we're basing the referrer base total off of total payment of the buyer
    const referredBySomeone = R.compose(R.not, R.either(R.isEmpty, R.isNil), R.prop('referred_by'))(userProfile)
    if (referredBySomeone) {
      const referrerReferralCode = R.prop('referred_by')(userProfile)
      getProfessionalUserByReferralCodeFromDB$$(referrerReferralCode)
        .subscribe(
          referrerUserProfile => {
            const referrerEmail = R.prop('email')(referrerUserProfile)
            addReferralCredit(userProfile, referralTotal, referrerEmail)
          },
          err => console.log('Something went wrong while getting referrer user profile by referralCode', err)
        )
    }
  }

  // If referred_to is present, wipe out the credit (since at every checkout, credit is auto-applied as discount)
  // This part applies both to initial and repeat checkout
  const referralCreditResetPayload = {
    metadata: {
      referral: {
        credit: 0
      }
    }
  }
  updateProfessionalUserInDB$$(email, referralCreditResetPayload).subscribe(
    dbRes => console.log('Successfully reset referral credit to zero', dbRes),
    err => console.log('Something went wrong while resetting referral credit', err)
  )
}

export const sendOrderEmail = (payload) => {
  sendEmail$$(payload).subscribe(
    res => console.log('Email successfully sent', res),
    err => console.log('Something went wrong while sending email: ', err)
  )
}

export const getPaymentMethods = () => {
  return [
    {value: 'cc', label: 'Credit Card'},
    {value: 'manual', label: 'Manual'},
  ]
}

export const createShippingLabels = (props, formData, orderObj) => {
  const {productDetails} = props
  const {email, shippingAddress, phone, shippingMethod} = formData
  const {lineItems} = orderObj
  const {
    name,
    line1: street1,
    zip,
    city,
    state,
    country,
  } = shippingAddress

  // Do nothing if shipment is manual
  if (shippingMethod === 'professionalManual') { return }

  /**
   * 1) Get the shipping boxes (or parcels in Shippo terms)
   * 2) Generate shipping label in Shippo
   */
  const lineItemsWithDimensions = getLineItemsWithDimensions(productDetails, lineItems)
  const shippingBoxesPayload = {lineItemsWithDimensions}

  getShippingBoxes$$(shippingBoxesPayload)
    .flatMap(packagesRes => {
      const parcels = R.map(parcel => {
        const {box, total_weight: weightInGrams} = parcel
        const weight = Math.round((weightInGrams * GRAMS_TO_POUNDS) * 10000) / 10000 // max is 4 decimal places
        const {
          length,
          width,
          height,
        } = box
        return {
          length: length.toString(),
          width: width.toString(),
          height: height.toString(),
          weight: weight.toString(),
          distance_unit: 'in',
          mass_unit: 'lb',
        }
      })(packagesRes)
      const addressTo = {
        email,
        name,
        street1,
        zip,
        city,
        state,
        country,
        phone,
      }
      const shipmentPayload = {addressTo, parcels, productDetails, lineItems, shippingMethod}
      return createShippingLabels$$(shipmentPayload)
    })
    .subscribe(
      transactionRes => console.log('Creating shipping labels successful'),
      err => console.log('Something went wrong while creating shipping labels', err)
    )
}

/**
 * Returns Observable with created Xero invoice obj as a response
 */
export const processXero$$ = (props, formData, orderObj) => {
  const {userProfile, locale} = props
  const {currency} = locale
  const isPro = !R.isNil(userProfile)
  const {metadata: userProfileMetadata} = userProfile || {}
  const {fname, lname, businessName} = userProfileMetadata || {}
  const {email, shippingAddress, phone, shippingMethod, paymentTerm, paymentMethod, salesTax} = formData
  const totalBeforeTax = getTotalBeforeTax(props, formData)
  const total = getTotal(props, formData)
  const salesTaxRate = Math.round(salesTax / totalBeforeTax * 10000) / 10000
  const {lineItems} = orderObj
  const {
    name,
    line1,
    city,
    state,
    zip,
    country,
  } = shippingAddress
  const xeroName = isPro ? convertToXeroName(businessName, email) : convertToXeroName(name, email)
  const shippingRate = getShippingRate(props, shippingMethod)
  const isFreeSample = checkIsFreeSample(props)
  const hasPaymentTerm = paymentTerm !== 0
  const isManualPayment = paymentMethod === 'manual'
  const dueDate = hasPaymentTerm ?
    moment().add(paymentTerm, 'day').toDate().toISOString().split("T")[0] :
    moment().toDate().toISOString().split("T")[0]
  const {
    sales: salesAccountCode,
    cashCad: cadCashAccountCode,
    cashUsd: usdCashAccountCode,
  } = XERO_ACCOUNT_CODES

  /**
   * 1) Create/update Xero customer
   * 2) Create Xero invoice
   * 3) Mark it paid if the charge is immediate (!hasPaymentTerm) and successful
   * 4) Adjust the price to 1 cent if sample (it'll have price of 0 otherwise)
   *    -> this will happen inside convertToXeroLineItems()
   */
  const contact = {
    Name: xeroName,
    FirstName: fname,
    LastName: lname,
    EmailAddress: email,
    Addresses: [
      {
        AddressType: 'STREET',
        AddressLine1: line1,
        City: city,
        Region: state,
        PostalCode: zip,
        Country: country,
      },
    ],
    Phones: [
      {
        PhoneType: 'DEFAULT',
        PhoneNumber: phone,
      }
    ]
  }
  return createOrUpdateXeroContact$$(contact)
    .flatMap((newContactRes) => {
      const xeroLineItems = convertToXeroLineItems(props, isFreeSample, isPro, lineItems, shippingRate, salesTaxRate)
      const invoice = {
        Type: 'ACCREC',
        Status: 'AUTHORISED',
        Contact: {
          Name: xeroName,
        },
        DueDate: dueDate,
        LineItems: xeroLineItems,
        CurrencyCode: currency.toUpperCase(),
      }
      return createXeroInvoice$$(invoice)
    })
    .flatMap((newInvoiceRes) => {
      /**
       * Defer payment if there's a payment term or manual payment - and return invoice obj
       */
      if (hasPaymentTerm || isManualPayment) {
        return Rx.Observable.return(newInvoiceRes)
      } else {
        const {
          InvoiceID: invoiceId,
          AmountDue: amountDue,
          CurrencyCode: currencyCode,
          CurrencyRate: currencyRate,
        } = newInvoiceRes
        const payment = {
          Invoice: {
            InvoiceID: invoiceId,
          },
          Account: {
            Code: currency === 'usd' ? usdCashAccountCode : cadCashAccountCode,
          },
          Date: new Date().toISOString().split("T")[0],
          Amount: amountDue,
          CurrencyCode: currencyCode,
          CurrencyRate: currencyRate,
        }
        return createXeroPayment$$(payment)
      }
    })
}

export const resetAllFields = (props) => {
  console.log('resetting fields')
  const {rootState} = props
  const allFieldStateIds = [
    EMAIL_FIELD_ID,
    SHIPPING_ADDRESS_NAME_FIELD_ID,
    SHIPPING_ADDRESS_LINE1_FIELD_ID,
    SHIPPING_ADDRESS_ZIP_FIELD_ID,
    SHIPPING_ADDRESS_CITY_FIELD_ID,
    SHIPPING_ADDRESS_STATE_FIELD_ID,
    SHIPPING_ADDRESS_COUNTRY_FIELD_ID,
    BILLING_ADDRESS_NAME_FIELD_ID,
    BILLING_ADDRESS_LINE1_FIELD_ID,
    BILLING_ADDRESS_ZIP_FIELD_ID,
    BILLING_ADDRESS_CITY_FIELD_ID,
    BILLING_ADDRESS_STATE_FIELD_ID,
    BILLING_ADDRESS_COUNTRY_FIELD_ID,
    PHONE_FIELD_ID,
    PAYMENT_TERM_FIELD_ID,
  ]
  R.forEach(fieldStateId => resetState(rootState, fieldStateId))(allFieldStateIds)

  changeState(SAME_SHIPPING_BILLING_CHECKBOX_ID, {checked: true})
  changeState(PAYMENT_METHOD_ID, {value: 'cc'})
}

export const runFinalCleanup = (props) => {
  console.log('Running final cleanup')
  resetAllFields(props)
  initFields(props)

  showPageLoadingSuccess()
  setTimeout(() => {
    changeState(PAY_BUTTON_ID, {disabled: false})
    hidePageLoading()
    hidePageLoadingSuccess()
  }, 2500)
}

export const getShippingStateIds = () => {
  return [
    SHIPPING_ADDRESS_NAME_FIELD_ID,
    SHIPPING_ADDRESS_LINE1_FIELD_ID,
    SHIPPING_ADDRESS_ZIP_FIELD_ID,
    SHIPPING_ADDRESS_CITY_FIELD_ID,
  ]
}

export const getBillingStateIds = () => {
  return [
    BILLING_ADDRESS_NAME_FIELD_ID,
    BILLING_ADDRESS_LINE1_FIELD_ID,
    BILLING_ADDRESS_ZIP_FIELD_ID,
    BILLING_ADDRESS_CITY_FIELD_ID,
  ]
}

export const copyShippingToBilling = (props) => {
  // Copy on: same shipping and billing checkbox click
  const {rootState} = props
  const shippingStateIds = getShippingStateIds()
  const billingStateIds = getBillingStateIds()

  const forEachIndexed = R.addIndex(R.forEach)
  forEachIndexed((shippingStateId, i) => {
    const billingStateId = billingStateIds[i]
    const shippingValue = R.prop('value', getElemState(rootState, shippingStateId))
    const billingValue = R.prop('value', getElemState(rootState, billingStateId))

    // only copy if the billing value is empty and set valid/touched state too
    if (R.isEmpty(billingValue) || R.isNil(billingValue)) {
      changeState(billingStateId, {value: shippingValue, valid: true, touched: true})
    }
  },shippingStateIds)
}

// Initialize both sync and async fields once ready is set to true
export const initFields = (props) => {
  // Initialize states
  const {countryCode, updateBilling, userProfile, shippingDetails} = props
  changeState(SHIPPING_ADDRESS_COUNTRY_FIELD_ID, {value: countryCode, label: R.prop(countryCode, availableCountries)})
  changeState(BILLING_ADDRESS_COUNTRY_FIELD_ID, {value: countryCode, label: R.prop(countryCode, availableCountries)})
  changeState(ADDRESS_TOGGLE_ID, {value: 'shipping'})
  changeState(PAYMENT_METHOD_ID, {value: 'cc'})
  changeState(PAYMENT_TERM_FIELD_ID, {value: 0})
  if (updateBilling) {
    changeState(SAME_SHIPPING_BILLING_CHECKBOX_ID, {value: false})
    copyShippingToBilling(props)
  } else {
    changeState(SAME_SHIPPING_BILLING_CHECKBOX_ID, {value: true})
  }

  // Initialize shippingMethod
  const shippingOptions = getShippingOptions(props)
  const shippingMethod = R.path([0, 'name'], shippingOptions)
  changeState(SHIPPING_METHOD_ID, {value: shippingMethod})

  // Initialize sales tax based on shipping address if prefilled
  // If not prefilled, set it to 0 for now and update when shipping address is filled in, calculate it
  const {prefill} = props
  const {customer} = props
  const isExistingCustomer = checkIsExistingCustomer(props)
  if (isExistingCustomer) {
    changeState(PAY_BUTTON_ID, {disabled: true})
    const {shipping} = customer
    const {address: customerShippingAddress} = shipping
    const shippingRate = getShippingRate(props, shippingMethod)
    const taxShippingData = {shippingAddress: customerShippingAddress}
    getSalesTax$$(props, taxShippingData, shippingRate).subscribe(
      taxObj => {
        const {amount_to_collect} = taxObj
        changeState(SALES_TAX_ID, {value: Math.round(amount_to_collect)})
        changeState(PAY_BUTTON_ID, {disabled: false})
      },
      err => {
        console.log('Something went wrong while retrieving sales tax', err)
        changeState(PAY_BUTTON_ID, {disabled: false})
      }
    )
  } else if (!R.isEmpty(prefill)) {
    changeState(PAY_BUTTON_ID, {disabled: true})
    const prefillObj = R.reduce((prev, {stateId, value}) => {
      return R.merge(prev, {[stateId]: value})
    }, {})(prefill)
    const customerShippingAddress = {
      line1: R.prop(SHIPPING_ADDRESS_LINE1_FIELD_ID, prefillObj),
      city: R.prop(SHIPPING_ADDRESS_CITY_FIELD_ID, prefillObj),
      zip: R.prop(SHIPPING_ADDRESS_ZIP_FIELD_ID, prefillObj),
      state: R.prop(SHIPPING_ADDRESS_STATE_FIELD_ID, prefillObj),
      country: countryCode,
    }
    const shippingRate = getShippingRate(props, shippingMethod)
    const taxShippingData = {shippingAddress: customerShippingAddress}
    getSalesTax$$(props, taxShippingData, shippingRate).subscribe(
      taxObj => {
        const {amount_to_collect} = taxObj
        changeState(SALES_TAX_ID, {value: Math.round(amount_to_collect)})
        changeState(PAY_BUTTON_ID, {disabled: false})
      },
      err => {
        console.log('Something went wrong while retrieving sales tax', err)
        changeState(PAY_BUTTON_ID, {disabled: false})
      }
    )
  } else {
    changeState(SALES_TAX_ID, {value: 0})
  }

  // Prefill fields for existing customers
  if (isExistingCustomer) {
    const {email, id: customerId, shipping, sources} = customer
    const {name: shippingName, phone, address: customerShippingAddress} = shipping
    const {
      city: shippingAddressCity,
      line1: shippingAddressLine1,
      postal_code: shippingAddressZip,
    } = customerShippingAddress
    const customerBillingAdress = R.compose(R.head, R.prop('data'))(sources)
    const {
      name: billingName,
      address_city: billingAddressCity,
      address_line1: billingAddressLine1,
      address_zip: billingAddressZip,
    } = customerBillingAdress
    const name = R.defaultTo(billingName, shippingName)
    changeState(SAME_SHIPPING_BILLING_CHECKBOX_ID, {value: false})
    changeState(EMAIL_FIELD_ID, {value: email, valid: true, touched: true})
    changeState(SHIPPING_ADDRESS_NAME_FIELD_ID, {value: name, valid: true, touched: true})
    changeState(SHIPPING_ADDRESS_LINE1_FIELD_ID, {value: shippingAddressLine1, valid: true, touched: true})
    changeState(SHIPPING_ADDRESS_ZIP_FIELD_ID, {value: shippingAddressZip, valid: true, touched: true})
    changeState(SHIPPING_ADDRESS_CITY_FIELD_ID, {value: shippingAddressCity, valid: true, touched: true})
    changeState(BILLING_ADDRESS_NAME_FIELD_ID, {value: name, valid: true, touched: true})
    changeState(BILLING_ADDRESS_LINE1_FIELD_ID, {value: billingAddressLine1, valid: true, touched: true})
    changeState(BILLING_ADDRESS_ZIP_FIELD_ID, {value: billingAddressZip, valid: true, touched: true})
    changeState(BILLING_ADDRESS_CITY_FIELD_ID, {value: billingAddressCity, valid: true, touched: true})
    changeState(PHONE_FIELD_ID, {value: phone, valid: true, touched: true})
  }

  // Prefill fields with given values and set it to valid+touched (i.e. assume all prefill values are valid)
  // Comes after existing customer prefill - prefill prop should be able to override it
  R.forEach(({stateId, value}) => {
    changeState(stateId, {value, valid: true, touched: true})
  })(prefill)

  // Initialize labels and error messages (for required validator only since by default it'll be empty)
  changeState(EMAIL_FIELD_ID, {label: 'Email', error: 'Please fill out the email'})
  changeState(SHIPPING_ADDRESS_NAME_FIELD_ID, {label: 'Name', error: 'Please fill out the name'})
  changeState(SHIPPING_ADDRESS_LINE1_FIELD_ID, {label: 'Address', error: 'Please fill out the street address'})
  changeState(SHIPPING_ADDRESS_ZIP_FIELD_ID, {error: 'Please fill out the postcode'})
  changeState(SHIPPING_ADDRESS_CITY_FIELD_ID, {error: 'Please fill out the city'})
  changeState(SHIPPING_ADDRESS_COUNTRY_FIELD_ID, {error: 'Please fill out the country'})
  changeState(BILLING_ADDRESS_NAME_FIELD_ID, {label: 'Name', error: 'Please fill out the name (in billing address)'})
  changeState(BILLING_ADDRESS_LINE1_FIELD_ID, {label: 'Address', error: 'Please fill out the street address'})
  changeState(BILLING_ADDRESS_ZIP_FIELD_ID, {error: 'Please fill out the postcode'})
  changeState(BILLING_ADDRESS_CITY_FIELD_ID, {error: 'Please fill out the city'})
  changeState(BILLING_ADDRESS_COUNTRY_FIELD_ID, {error: 'Please fill out the country'})
  changeState(PHONE_FIELD_ID, {label: 'Phone', error: 'Please fill out the phone'})
  changeState(SHIPPING_METHOD_ID, {label: 'Shipping'})
  changeState(PAYMENT_TERM_FIELD_ID, {label: 'Pay Term', error: 'Please fill out the payment term'})
}
