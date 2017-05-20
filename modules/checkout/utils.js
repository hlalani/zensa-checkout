import R from 'ramda'
import axios from 'axios'
import moment from 'moment'
import {
  REFERRAL_CREDIT_RATE,
  NUMBING_CREAM_30G_SKU,
  RETAIL_VOLUME_DISCOUNT_TABLE,
  REFERRED_CREDIT_RATE,
} from '../global/constants'
import {
  getProUserByReferralCodeFromDB$$,
  updateProUserReferralCreditInDB$$,
  updateProUserInDB$$,
} from '../professional-users/observables'
import {sendEmail$$} from '../sendgrid/observables'
import stateList from '../locale/states.json'

/**
 * UTILITY FUNCTIONS
 */

function checkQualifiesForSigningBonus(userProfile) {
  const isPro = !R.isNil(userProfile)
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
  updateProUserReferralCreditInDB$$(referrerEmail, payload).subscribe(
    dbRes => console.log('updateProUserReferralCreditInDB$$ successful', dbRes),
    err => console.log('Something went wrong while running updateProUserReferralCreditInDB$$', err)
  )
}

function parseGoogleAddressComponents(addressComponents, type) {
  return R.compose(R.prop('long_name'), R.head, R.filter(R.where({types: R.contains(type)})))(addressComponents)
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

// Returns discount per unit in dollars
// getProfessionalUnitDiscount :: {*} -> Integer -> Integer -> Integer
function getProfessionalUnitDiscount(professionalDiscountMap, originalPrice, quantity) {
  if (R.isNil(professionalDiscountMap)) { return 0 }
  const prices = R.pluck('price', professionalDiscountMap) // [2500, 2000, 1800]
  const quantities = R.pluck('quantity', professionalDiscountMap) // [10, 24, 96]
  const rangeIndex = indexOfRange(quantities, quantity) // 1
  return rangeIndex <= 0 ? 0 : (originalPrice - R.prop(rangeIndex - 1, prices)) // 3000 (i.e. 5500 - 2500)
}

function getProVolumeDiscounts(currency, productDetails, cartItemsWithDetail) {
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

function getProVolumeDiscount(proVolumeDiscounts) {
  if (R.isEmpty(proVolumeDiscounts)) { return 0 }
  return R.compose(R.sum, R.values)(proVolumeDiscounts)
}

// getDiscountRate :: Integer -> Integer
function getDiscountRate(quantity) {
  return quantity <= 3 ? R.prop(quantity, RETAIL_VOLUME_DISCOUNT_TABLE) : R.compose(R.last, R.values)(RETAIL_VOLUME_DISCOUNT_TABLE) || 0
}

function getRetailVolumeDiscount(cartItems, productSubtotals) {
  const discounts = R.mapObjIndexed((quantity, sku) => {
    const subtotalForSku = R.prop(sku, productSubtotals)
    const discountForSku = subtotalForSku * (getDiscountRate(quantity) / 100)
    return discountForSku
  })(cartItems) // {627843518181: 11000 * 10%, 627843518181: 16500 * 15%, ...}
  return R.compose(R.sum, R.values)(discounts)
}

function getStateCode(stateName) {
  return R.prop(stateName, stateList)
}

/* --- EXPORTED FUNCTIONS --- */

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
  const isPro = !R.isNil(userProfile)

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
    const qualifiesForSigningBonus = checkQualifiesForSigningBonus(userProfile)

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

        return R.append({
          sku: R.prop('sku', numbingCreamProductDetails),
          name: R.prop('name', numbingCreamProductDetails),
          quantity: 1,
          price: R.path(['price', currency], numbingCreamProductDetails),
          thumbUrl: R.prop('thumbUrl', numbingCreamProductDetails),
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

export const getDiscount = (props) => {
  const {userProfile = null, cartItems, locale, productDetails, coupon} = props
  const {currency} = locale
  const isPro = !R.isNil(userProfile)
  const cartItemsWithDetail = getCartItemsWithDetail(props)
  const productSubtotals = getProductSubtotals(locale, productDetails, cartItems)
  const subtotal = getSubtotal(props)
  const couponDiscount = R.isNil(coupon) ? 0 : getCouponDiscount(cartItemsWithDetail, subtotal, coupon)

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
  const isPro = !R.isNil(userProfile)

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

export const getShippingOptions = (userProfile, shippingDetails) => {
  const isPro = !R.isNil(userProfile)
  if (isPro) {
    return R.filter(option => R.prop('professional', option), shippingDetails)
  } else {
    return R.filter(option => !R.prop('professional', option), shippingDetails)
  }
}

export const getShippingRate = (props, shippingMethod) => {
  const {userProfile = null, locale, shippingDetails, productDetails, cartItems} = props
  const isPro = !R.isNil(userProfile)
  const {currency} = locale
  const currentShippingMethodDetails = R.compose(R.head, R.filter(obj => obj.name === shippingMethod))(shippingDetails)

  if (isPro) {
    const ratesByWeight = R.path(['ratesByWeight', currency], currentShippingMethodDetails) || 0
    return getProShippingRate(ratesByWeight, productDetails, cartItems)
  } else {
    return R.path(['price', currency], currentShippingMethodDetails) || 0
  }
}

export const getTotal = (props, shippingMethod) => {
  const {billingZip, billingState, locale} = props
  const {countryCode} = locale
  const subtotal = getSubtotal(props)
  const shippingRate = getShippingRate(props, shippingMethod)
  const salesTax = getSalesTax(props, subtotal, shippingRate)
  const discount = getDiscount(props)
  const subtotalAfterDiscount = subtotal - discount
  const referralCredit = getReferralCredit(props, subtotalAfterDiscount)
  return subtotal + shippingRate + salesTax - discount - referralCredit
}

export const getStateFromFullAddress$$ = (fullAddress) => {
  const encodedAddress = encodeURIComponent(fullAddress)
  return Rx.Observable.fromPromise(axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&sensor=true`))
    .map(res => {
      const addressComponents = res.data.results[0].address_components
      const state = parseGoogleAddressComponents(addressComponents, 'administrative_area_level_1')
      const stateCode = getStateCode(state)
      return stateCode
    })
}

export const getSalesTax = (zip, stateCode, countryCode, subtotal, shippingRate) => {
  return 0
}

export const handleReferral = (props) => {
  const {userProfile, customer} = props
  const total = getTotal(props, shippingMethod)

  if (R.isNil(customer)) {
    // If referred_by is present, then add credit to the referrer account
    // This part only applies to initial checkout since credit is accrued to the referrer on initial purchase ONLY
    const referralTotal = total // we're basing the referrer base total off of total payment of the buyer
    const referredBySomeone = R.compose(R.not, R.either(R.isEmpty, R.isNil), R.prop('referred_by'))(userProfile)

    if (referredBySomeone) {
      const referrerReferralCode = R.prop('referred_by')(userProfile)
      getProUserByReferralCodeFromDB$$(referrerReferralCode)
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
  updateProUserInDB$$(email, referralCreditResetPayload).subscribe(
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
