import R from 'ramda'

export const getLineItemsWithDimensions = (productDetails, lineItems) => {
  return R.map(lineItem => {
    const {sku} = lineItem
    const thisProduct = R.find(R.propEq('sku', sku))(productDetails)
    const {width, height, length, weight} = thisProduct
    return {
      sku,
      width,
      height,
      length,
      weight,
    }
  })(lineItems)
}
