import R from 'ramda'
import {
  XERO_SHIPPING_SKU,
  XERO_ACCOUNT_CODES,
} from '../global/constants'
import {
  getProfessionalUnitDiscount,
  getRetailDiscountRate,
} from '../checkout/utils'
import {checkIsPharmaLineItem} from '../orders/core'

export const convertToXeroName = (businessName, email) => {
  return `${businessName} (${email})`
}

export const convertToXeroLineItems = (props, isFreeSample, isPro, lineItems, shippingRate) => {
  const {productDetails, locale} = props
  const {currency} = locale
  const {sales: salesAccountCode} = XERO_ACCOUNT_CODES
  const xeroLineItems = R.map(item => {
    const {sku, quantity} = item
    const thisProduct = R.find(R.propEq('sku', sku), productDetails)
    const {name, description} = thisProduct

    // Calculate the pro unit price using wholesale unit price discount
    const originalPrice = R.path(['price', currency])(thisProduct)
    const professionalDiscountMap = R.path(['wholesalePriceMap', currency])(thisProduct)
    const proUnitDiscount = getProfessionalUnitDiscount(professionalDiscountMap, originalPrice, quantity)
    const proUnitPrice = originalPrice - proUnitDiscount

    // Calculate the retail unit price using retail volume discount
    const retailUnitDiscount = getRetailDiscountRate(quantity) * originalPrice
    const retailUnitPrice = originalPrice - retailUnitDiscount

    const unitPrice = isPro ? proUnitPrice : retailUnitPrice

    /**
     * If the order is a free sample OR the line item is NOT a pharma item, return 1 cent (not 0)
     * Otherwise, return the unitPrice
     * NOTE: free shipping on sample
     */
    const finalUnitPrice = isFreeSample || !checkIsPharmaLineItem(item) ? 1 : unitPrice
    const finalShippingRate = isFreeSample ? 0 : shippingRate

    // Divide UnitPrice by 100 since Xero requires amount in dollars in String, not cents in Integer
    return {
      Code: sku,
      AccountCode: salesAccountCode,
      Quantity: quantity,
      Name: name,
      UnitPrice: (finalUnitPrice / 100).toFixed(2).toString()
      // Description: description,
    }
  }, lineItems)

  // Before returning, add shipping as a line item as per Xero docs recommendation
  return R.merge(xeroLineItems, {
    Code: XERO_SHIPPING_SKU,
    AccountCode: salesAccountCode,
    Quantity: 1,
    Name: 'Shipping',
    UnitPrice: (finalShippingRate / 100).toFixed(2).toString()
    // Description: description,
  })
}
