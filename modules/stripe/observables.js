import Rx from 'rx-lite'
import R from 'ramda'
import axios from 'axios'
import config from '../../client-config'

export const getCustomer$$ = email => {
  const encodedEmail = encodeURIComponent(email)
  return Rx.Observable.fromPromise(axios.get(`${config.apiBase}/api/stripe/customer?email=${encodedEmail}`))
    .map(res => res.data)
}

export const deleteCustomer$$ = email => {
  const encodedEmail = encodeURIComponent(email)
  return Rx.Observable.fromPromise(axios.delete(`${config.apiBase}/api/stripe/customer?email=${encodedEmail}`))
    .map(res => res.data)
}

export const createCustomer$$ = (stripeToken, stripeAddress, stripeMetadata) => {
  // stripeToken = {id: 'token_id', email: 'customer@email.com'}
  const payload = {
    stripeToken,
    stripeAddress,
    stripeMetadata
  }

  return Rx.Observable.create(observer => {
    axios({
      url: `${config.apiBase}/api/stripe/customer`,
      method: 'post',
      headers: {
        'content-type': 'application/json'
      },
      data: payload
    })
      .then(resObj => {
        const resObjData = resObj.data
        if (R.has('err', resObjData)) {
          observer.onError(resObjData.err)
        } else {
          observer.onNext(resObjData)
          observer.onCompleted()
        }
      })
      .catch(err => {
        observer.onError(err)
      })
  })
}

export const createCustomerAndCharge$$ = (stripeToken, stripeAddress, stripeMetadata, stripeOptions) => {
  // stripeToken = {id: 'token_id', email: 'customer@email.com'}
  const {amount, currency} = stripeOptions
  const payload = {
    stripeToken,
    stripeAddress,
    stripeMetadata
  }

  return Rx.Observable.create(observer => {
    axios({
      url: `${config.apiBase}/api/stripe/customer/charge?amount=${amount}&currency=${currency}`,
      method: 'post',
      headers: {
        'content-type': 'application/json'
      },
      data: payload
    })
      .then(resObj => {
        const resObjData = resObj.data
        if (R.has('err', resObjData)) {
          observer.onError(resObjData.err)
        } else {
          observer.onNext(resObjData)
          observer.onCompleted()
        }
      })
      .catch(err => {
        observer.onError(err)
      })
  })
}

/*
  payload = {
    customerId,
    amount,
    currency
  }
*/
export const charge$$ = payload => {
  return Rx.Observable.create(observer => {
    axios.post(`${config.apiBase}/api/stripe/charge`, payload)
      .then(resObj => {
        const resObjData = resObj.data
        if (R.has('err', resObj)) {
          observer.onError(resObjData.err)
        } else {
          observer.onNext(resObjData)
          observer.onCompleted()
        }
      })
      .catch(err => observer.onError(err))
  })
}
