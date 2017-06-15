import React from 'react'
import {render} from 'react-dom'
import Rx from 'rx-lite'
import R from 'ramda'
import axios from 'axios'
import config from '../client-config'

import {NUMBING_CREAM_30G_SKU} from '../modules/global/constants'
import {state$} from '../modules/state/observables'
import {changeState} from '../modules/state/events'
import {getElemState} from '../modules/state/core'
import {runCustomEventsPolyfill} from '../modules/polyfill/custom-events'
import localeObj from '../modules/locale/locales.json'

import '../assets/styles/main.css'

import App from './App'

runCustomEventsPolyfill()

const getShippingDetails$ = Rx.Observable.create(observer => {
  axios.get(`${config.apiBase}/api/shipping`)
    .then(dbRes => {
      observer.onNext(dbRes.data)
      observer.onCompleted()
    })
    .catch(err => observer.onError(err))
})
const getProductDetails$ = Rx.Observable.create(observer => {
  fetch(config.apiBase + '/api/products')
    .then(res => res.json())
    .then(dbRes => {
      // console.log('dbRes in getProductDetails$', dbRes)
      observer.onNext(dbRes)
      observer.onCompleted()
    })
    .catch(err => observer.onError())
})
getShippingDetails$.subscribe(shippingDetails => changeState('shippingDetailsDemoState', shippingDetails))
getProductDetails$.subscribe(productDetails => changeState('productDetailsDemoState', productDetails))

const stripeInstance = window.Stripe('pk_test_dzjZAkQ63whoQXIxplDnt77W')
const countryCode = 'CA'
const locale = R.prop('en-CA', localeObj)
const cartItems = {
  [NUMBING_CREAM_30G_SKU]: 2,
}
const track = {
  checkout: () => {},
  purchase: () => {},
  professionalPurchase: () => {},
  professionalAddBilling: () => {},
  professionalChargeScheduled: () => {},
}
const prefill = [
  {
    stateId: 'zcoEmailField',
    value: 'seunggs@gmail.com',
  },
  {
    stateId: 'zcoShippingAddressNameField',
    value: 'Seungchan Lee',
  },
  {
    stateId: 'zcoShippingAddressLine1Field',
    value: '1415 - 938 Smithe St',
  },
  {
    stateId: 'zcoShippingAddressZipField',
    value: 'V6Z3H8',
  },
  {
    stateId: 'zcoShippingAddressCityField',
    value: 'Vancouver',
  },
  {
    stateId: 'zcoPhoneField',
    value: '123-456-7890',
  },
]
const userProfile = {
    "clientID": "YCewZfQ0fiqugGpryyFTU7j4wAQINLHV",
    "created_at": "2017-03-21T04:40:26.655Z",
    "email": "seunggs@gmail.com",
    "email_verified": false,
    "global_client_id": "O1UK79hM5rTdRGzLWdBIBoN1tC6orwoU",
    "id": "9ef46b3d-32a3-4e5e-8262-745b1268cd1f",
    "identities": [{
        "connection": "Username-Password-Authentication",
        "isSocial": false,
        "provider": "auth0",
        "user_id": "58d0aeba6983e422876e9eb5"
    }],
    "metadata": {
        "businessName": "Test",
        "businessWebsite": "Test",
        "fname": "Seungchan",
        "freeSampleAlreadySent": true,
        "lname": "Lee",
        "professional": true,
        "referral": {
            "credit": 0
        },
        "story": "Test"
    },
    "name": "seunggs@gmail.com",
    "nickname": "seunggs",
    "picture": "https://s.gravatar.com/avatar/9381c58d295694bd913fffc38c46123c?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fse.png",
        "referralCode": "SLEE",
    "referred_by": "",
    "updated_at": "2017-03-21T04:40:27.146Z",
    "user_id": "auth0|58d0aeba6983e422876e9eb5"
}

state$.subscribe(
  rootState => {
    const productDetailsState = getElemState(rootState, 'productDetailsDemoState')
    const productDetails = R.isEmpty(productDetailsState) ? [] : productDetailsState
    const shippingDetailsState = getElemState(rootState, 'shippingDetailsDemoState')
    const shippingDetails = R.isEmpty(shippingDetailsState) ? [] : shippingDetailsState
    const ready = !R.isEmpty(productDetails) && !R.isEmpty(shippingDetails) ? true : false

    render(
      <App
        ready={ready}
        rootState={rootState}
        stripe={stripeInstance}
        locale={locale}
        track={track}
        prefill={prefill}
        userProfile={userProfile}
        countryCode={countryCode}
        productDetails={productDetails}
        shippingDetails={shippingDetails}
        cartItems={cartItems}
        onChargeSuccess={() => {console.log('onChargeSuccess ran!')}}
        onCreateCustomerSuccess={() => {console.log('onCreateCustomerSuccess ran!')}}
        isPos={true}
      />, document.getElementById('app')
    )
  }
)

changeState('global', {})

export default App
