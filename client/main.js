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
const locale = R.prop('en-US', localeObj)
const cartItems = {
  [NUMBING_CREAM_30G_SKU]: 2,
}

state$.subscribe(
  rootState => {
    const productDetailsState = getElemState(rootState, 'productDetailsDemoState')
    const productDetails = R.isEmpty(productDetailsState) ? [] : productDetailsState
    const shippingDetailsState = getElemState(rootState, 'shippingDetailsDemoState')
    const shippingDetails = R.isEmpty(shippingDetailsState) ? [] : shippingDetailsState

    render(
      <App
        rootState={rootState}
        stripe={stripeInstance}
        locale={locale}
        productDetails={productDetails}
        shippingDetails={shippingDetails}
        cartItems={cartItems}
      />, document.getElementById('app')
    )
  }
)

changeState('global', {})

export default App
