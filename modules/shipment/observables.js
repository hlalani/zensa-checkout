import config from '../../client-config'
import axios from 'axios'
import Rx from 'rx-lite'

/*
  payload = {
    addressTo: {
      name,
      street1,
      city,
      state,
      zip,
      country,
      phone,
      email,
    },
    parcels: [
      {
        length,
        width,
        height,
        weight,
        distance_unit,
        mass_unit,
      },
    ],
    productDetails: [
      ...
    ],
    lineItems: [
      {
        quantity,
        sku,
      },
      ...
    ],
    shippingMethod: 'upsGround',
  }
}
*/
export const createShippingLabels$$ = (payload) => {
  return Rx.Observable.create(observer => {
    axios.post(`${config.apiBase}/api/shipment`, payload)
      .then(res => {
        observer.onNext(res.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}
