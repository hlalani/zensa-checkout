import R from 'ramda'

export const getLineItemsWithDimensions = (productDetails, lineItems) => {
  return R.map(lineItem => {
    const {sku, quantity} = lineItem
    const thisProduct = R.find(R.propEq('sku', sku))(productDetails)
    const {width, height, length, weight} = thisProduct
    return {
      sku,
      quantity,
      width,
      height,
      length,
      weight,
    }
  })(lineItems)
}
