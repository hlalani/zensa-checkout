import config from '../../client-config'
import axios from 'axios'
import Rx from 'rx-lite'

/*
  payload = {
    lineItemsWithDimensions: [
      {
        sku,
        width,
        height,
        length,
        weight,
      },
      ...
    ],
    options,
  }
*/
export const getShippingBoxes$$ = (payload) => {
  return Rx.Observable.create(observer => {
    axios.post(`${config.apiBase}/api/box-packing`, payload)
      .then(res => {
        observer.onNext(res.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}
