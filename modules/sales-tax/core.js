import R from 'ramda'
import {
  PRODUCT_TAX_CODE,
} from '../global/constants'
import {
  getProfessionalUnitDiscount,
  getRetailDiscountRate,
} from '../checkout/utils'
import {checkIsPharmaLineItem} from '../orders/core'

export const convertToTaxLineItems = (props, isFreeSample, isPro, lineItems) => {
  const {productDetails, locale} = props
  const {currency} = locale
  return R.map(item => {
    const {sku, quantity} = item
    const {pharma: pharmaProductTaxCode, other: otherProductTaxCode} = PRODUCT_TAX_CODE
    const thisProduct = R.find(R.propEq('sku', sku), productDetails)
    const {name, description} = thisProduct
    const isPharmaLineItem = checkIsPharmaLineItem(item)

    // Calculate the pro unit price using wholesale unit price discount
    const originalPrice = R.path(['price', currency])(thisProduct)
    const professionalDiscountMap = R.path(['wholesalePriceMap', currency])(thisProduct)
    const proUnitDiscount = getProfessionalUnitDiscount(professionalDiscountMap, originalPrice, quantity)
    const proUnitPrice = originalPrice - proUnitDiscount

    // Calculate the retail unit price using retail volume discount
    const retailUnitDiscount = (getRetailDiscountRate(quantity) / 100) * originalPrice
    const retailUnitPrice = originalPrice - retailUnitDiscount

    const unitPrice = isPro ? proUnitPrice : retailUnitPrice

    /**
     * If the order is free sample or the line item is NOT a pharma item, return 1 cent (not 0)
     * Otherwise, return the unitPrice
     */
    const finalUnitPrice = isFreeSample || !isPharmaLineItem ? 0 : Math.round(unitPrice) / 100

    // TaxJar requires amount in dollars in Float, not cents in Integer
    return {
      id: sku,
      quantity,
      product_tax_code: isPharmaLineItem ? pharmaProductTaxCode : otherProductTaxCode,
      unit_price: finalUnitPrice,
      discount: 0,
    }
  }, lineItems)
}
