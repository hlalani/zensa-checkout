import React from 'react'
import {render} from 'react-dom'
import Rx from 'rx-lite'
import R from 'ramda'
import axios from 'axios'
import config from '../client-config'
import {storiesOf} from '@storybook/react'

import {
  NUMBING_CREAM_30G_SKU,
  MICROBLADING_PACK_SKU,
  SAMPLE_PACK_SKU,
} from '../modules/global/constants'
import {state$} from '../modules/state/observables'
import {changeState} from '../modules/state/events'
import {getElemState} from '../modules/state/core'
import localeObj from '../modules/locale/locales.json'

import '../assets/styles/main.css'
import App from '../client/App'

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
  "created_at": "2017-03-21T04:40:26.655Z",
  "email": "seunggs@gmail.com",
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
  "referralCode": "SLEE",
  "referred_by": "",
}

storiesOf('Zensa Checkout', module)
  .addDecorator(story => {
    return (
      <div style={{backgroundColor: '#E6EBF1'}}>
        <div className="container">
          <div className="row center-xs">
            <div className="col-xs-12 col-md-5" style={{textAlign: 'left'}}>
              {story()}
            </div>
          </div>
        </div>
      </div>
    )
  })
  .add('Retail', () => {
    // const rootState = {}
    // const ready = true
    // const productDetails = []
    // const shippingDetails = []
    // const countryCode = 'CA'
    // const locale = R.prop('en-CA', localeObj)
    // const cartItems = {
    //   [MICROBLADING_PACK_SKU]: 2,
    // }
    // return (
    //   <App
    //     ready={ready}
    //     rootState={rootState}
    //     stripe={stripeInstance}
    //     locale={locale}
    //     track={track}
    //     prefill={prefill}
    //     userProfile={userProfile}
    //     countryCode={countryCode}
    //     productDetails={productDetails}
    //     shippingDetails={shippingDetails}
    //     cartItems={cartItems}
    //     onChargeSuccess={() => {console.log('onChargeSuccess ran!')}}
    //     onCreateCustomerSuccess={() => {console.log('onCreateCustomerSuccess ran!')}}
    //     isPos={true}
    //   />
    // )

    state$.subscribe(rootState => {
      const productDetailsState = getElemState(rootState, 'productDetailsDemoState')
      const productDetails = R.isEmpty(productDetailsState) ? [] : productDetailsState
      const shippingDetailsState = getElemState(rootState, 'shippingDetailsDemoState')
      const shippingDetails = R.isEmpty(shippingDetailsState) ? [] : shippingDetailsState
      const ready = !R.isEmpty(productDetails) && !R.isEmpty(shippingDetails) ? true : false
      const countryCode = 'CA'
      const locale = R.prop('en-CA', localeObj)
      const cartItems = {
        [MICROBLADING_PACK_SKU]: 2,
      }
      console.log('ready', ready)

      return (
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
        />
      )
    })
    changeState('global', {})
  })