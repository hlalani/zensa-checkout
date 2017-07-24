import R from 'ramda'
import {
  PHARMA_LINE_ITEMS,
  HEALING_CREAM_5ML_SAMPLE_SKU,
} from '../global/constants'

/*
  NOTES:
  * cartItems pertain to orders - i.e. 1 tattoo box
  * lineItems pertain to inventory - i.e. 1 NC + 2 HC sachets + 1 alcohol swab + 1 MD Tegaderm

  orderObject = {
    created: 1492386910,
    name,
    email,
    phone,
    cartItems: [
      {sku: '627843518167', quantity: 1},
      ...
    ],
    lineItems: [
      {sku: '627843518167', quantity: 1},
      ...
    ],
    shipping: {
      address_line1,
      address_zip,
      address_city,
      address_state,
      address_country,
    },
    shippingMethod
    shipped: true
  }
*/

const log = x => { console.log(x); return x }

export const getLineItems = (productDetails, cartItems) => {
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

export const createOrder = (productDetails, cartItems, customer, shipping, shippingMethod) => {
  const {email, name, businessName, phone} = customer
  const skus = R.keys(cartItems)
  const modifiedCartItems = R.compose(R.values, R.mapObjIndexed((quantity, sku, obj) => ({sku, quantity})))(cartItems)
  const lineItems = getLineItems(productDetails, cartItems)

  return {
    email,
    name,
    businessName,
    phone,
    cartItems: modifiedCartItems,
    lineItems,
    shipping,
    shippingMethod,
    shipped: false
  }
}

export const checkIsPharmaLineItem = (lineItem) => {
  return R.contains(lineItem.sku, PHARMA_LINE_ITEMS)
}

export const checkIsSampleSachet = (lineItem) => {
  const {sku} = lineItem
  return sku === HEALING_CREAM_5ML_SAMPLE_SKU
}
