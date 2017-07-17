import R from 'ramda'
import Rx from 'rx-lite'
import axios from 'axios'
import {FULFILLMENT_CENTER_ADDRESS} from '../global/constants'
import config from '../../client-config'

export const calcSalesTax$$ = (shippingAddress, amount, shippingRate, taxLineItems) => {
  const {
    line1: from_street,
    city: from_city,
    state: from_state,
    zip: from_zip,
    country: from_country,
  } = FULFILLMENT_CENTER_ADDRESS
  const {
    line1: to_street,
    city: to_city,
    state: to_state, // 'AZ'
    zip: to_zip,
    country: to_country, // 'US'
  } = shippingAddress

  /*
    line_items: [
      {
        id: '1',
        quantity: 1,
        product_tax_code: '20010',
        unit_price: 15,
        discount: 0
      }
    ]
  */
  const payload = {
    from_country,
    from_zip,
    from_state,
    from_city,
    from_street,
    to_country,
    to_zip,
    to_state,
    to_city,
    to_street,
    amount,
    shipping: shippingRate,
    line_items: taxLineItems,
  }

  return Rx.Observable.fromPromise(axios.post(`${config.apiBase}/api/sales-tax`, payload))
    .map(taxRes => taxRes.data.tax)
}
