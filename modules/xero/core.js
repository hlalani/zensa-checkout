import R from 'ramda'
import {
  XERO_SHIPPING_SKU,
  XERO_ACCOUNT_CODES,
} from '../global/constants'
import {
  getProfessionalUnitDiscount,
  getRetailDiscountRate,
} from '../checkout/utils'
import {
  checkIsPharmaLineItem,
  checkIsSampleSachet,
} from '../orders/core'

export const convertToXeroName = (businessName, email) => {
  return `${businessName} (${email})`
}

export const convertToXeroLineItems = (props, isFreeSample, isPro, lineItems, shippingRate, salesTaxRate) => {
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
    const retailUnitDiscount = (getRetailDiscountRate(quantity) / 100) * originalPrice
    const retailUnitPrice = originalPrice - retailUnitDiscount

    const unitPrice = isPro ? proUnitPrice : retailUnitPrice

    const isSampleSachet = checkIsSampleSachet(item)

    /**
     * If the order is a free sample OR the line item is NOT a pharma item OR it's a sample sachet, return 1 cent (not 0)
     * Otherwise, return the unitPrice
     */
    const finalUnitPrice = isFreeSample || !checkIsPharmaLineItem(item) || isSampleSachet ? 1 : unitPrice

    // Xero requires amount in dollars in Float, not cents in Integer
    return {
      Code: sku,
      AccountCode: salesAccountCode,
      Quantity: quantity,
      Name: name,
      UnitAmount: Math.round(finalUnitPrice) / 100,
      TaxAmount: Math.round(finalUnitPrice * quantity * salesTaxRate) / 100,
      Description: name,
    }
  }, lineItems)

  //  NOTE: free shipping on sample
  const finalShippingRate = isFreeSample ? 0 : shippingRate

  // Before returning, add shipping as a line item as per Xero docs recommendation
  return R.append({
    Code: XERO_SHIPPING_SKU,
    AccountCode: salesAccountCode,
    Quantity: 1,
    Name: 'Shipping',
    UnitAmount: Math.round(finalShippingRate) / 100,
    TaxAmount: Math.round(finalShippingRate * salesTaxRate) / 100,
    Description: 'Shipping',
  })(xeroLineItems)
}
