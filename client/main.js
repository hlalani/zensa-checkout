import React from 'react'
import {render} from 'react-dom'
import Rx from 'rx-lite'
import R from 'ramda'
import axios from 'axios'
import config from '../client-config'

import {
  NUMBING_CREAM_30G_SKU,
  MICROBLADING_PACK_SKU,
  SAMPLE_PACK_SKU,
} from '../modules/global/constants'
import {state$} from '../modules/state/observables'
import {changeState} from '../modules/state/events'
import {getElemState} from '../modules/state/core'
import {runCustomEventsPolyfill} from '../modules/polyfill/custom-events'

import '../assets/styles/main.css'

import TestCases from './TestCases'

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
const track = {
  checkout: () => {},
  purchase: () => {},
  professionalSamplePurchase: () => {},
  professionalPurchase: () => {},
  professionalAddBilling: () => {},
  professionalChargeScheduled: () => {},
}

state$.subscribe(
  rootState => {
    const productDetailsState = getElemState(rootState, 'productDetailsDemoState')
    const productDetails = R.isEmpty(productDetailsState) ? [] : productDetailsState
    const shippingDetailsState = getElemState(rootState, 'shippingDetailsDemoState')
    const shippingDetails = R.isEmpty(shippingDetailsState) ? [] : shippingDetailsState

    render(
      <TestCases
        rootState={rootState}
        stripe={stripeInstance}
        track={track}
        productDetails={productDetails}
        shippingDetails={shippingDetails}
      />, document.getElementById('app')
    )
  }
)

changeState('global', {})
