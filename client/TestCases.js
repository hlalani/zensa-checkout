import React, {Component} from 'react'
import PropTypes from 'prop-types'
import R from 'ramda'
import {changeState} from '../modules/state/events'
import {getElemState} from '../modules/state/core'
import {
  CURRENT_TEST_CASE_ID,
  CURRENT_TEST_CASE_READY_ID,
  CURRENT_TEST_CASE_COUNTRY_CODE_ID,
  CURRENT_TEST_CASE_LOCALE_ID,
  CURRENT_TEST_CASE_EXPECTED_ID,
  SHIPPING_METHOD_ID,
  SHIPPING_ADDRESS_LINE1_FIELD_ID,
  SHIPPING_ADDRESS_CITY_FIELD_ID,
  SHIPPING_ADDRESS_ZIP_FIELD_ID,
  SHIPPING_ADDRESS_STATE_FIELD_ID,
  SHIPPING_ADDRESS_COUNTRY_FIELD_ID,
  SAME_SHIPPING_BILLING_CHECKBOX_ID,
  SALES_TAX_ID,
  PAY_BUTTON_ID,
} from '../modules/state/constants'
import localeObj from '../modules/locale/locales.json'
import {
  getTestCase,
  getTestCaseExpected,
} from '../modules/test-cases/core'
import {
  getShippingOptions,
  getShippingRate,
  getSalesTax$$,
} from '../modules/checkout/utils'
import {showPageLoading, hidePageLoading} from '../modules/page-loading/core'
import App from './App'

export default class TestCases extends Component {
  static propTypes = {
    rootState: PropTypes.object.isRequired,
    stripe: PropTypes.object.isRequired, // Different for website & POS
    productDetails: PropTypes.array.isRequired, // ASYNC
    shippingDetails: PropTypes.array.isRequired, // ASYNC
    track: PropTypes.object.isRequired, // ASYNC; Mixpanel, FB pixel
  }
  constructor(props) {
    super(props)
  }

  getValue = (stateId) => {
    const {rootState} = this.props
    return R.prop('value', getElemState(rootState, stateId))
  }

  handleClick = (e, testCaseKey) => {
    const isInternational = testCaseKey === 'proInternational'

    // Reset ready and other initializations
    changeState(CURRENT_TEST_CASE_READY_ID, {value: false})
    changeState(SAME_SHIPPING_BILLING_CHECKBOX_ID, {value: true})
    const countryCode = isInternational ? 'US' : 'CA'
    changeState(CURRENT_TEST_CASE_COUNTRY_CODE_ID, {value: countryCode})
    const locale = isInternational ? R.prop('en-US', localeObj) : R.prop('en-CA', localeObj)
    changeState(CURRENT_TEST_CASE_LOCALE_ID, {value: locale})
    showPageLoading()

    // HACK: Wait til ready resets - just use setTimeout
    setTimeout(() => {
      hidePageLoading()

      const testCase = getTestCase(testCaseKey)
      changeState(CURRENT_TEST_CASE_ID, {value: testCase})

      if (testCase.updateBilling) {
        changeState(SAME_SHIPPING_BILLING_CHECKBOX_ID, {value: false})
      } else {
        changeState(SAME_SHIPPING_BILLING_CHECKBOX_ID, {value: true})
      }

      // Set expected text
      const testCaseExpected = getTestCaseExpected(testCaseKey)
      changeState(CURRENT_TEST_CASE_EXPECTED_ID, {value: testCaseExpected})

      // Set ready to true
      changeState(CURRENT_TEST_CASE_READY_ID, {value: true})
    }, 1000)
  }

  render() {
    const {
      rootState,
      stripe,
      productDetails,
      shippingDetails,
      track,
    } = this.props
    const {
      prefill = [],
      userProfile,
      customer,
      cartItems = {},
      isPos = false,
      coupon = {},
      updateBilling = false,
    } = this.getValue(CURRENT_TEST_CASE_ID) || {}
    const ready = this.getValue(CURRENT_TEST_CASE_READY_ID) || false
    const countryCode = this.getValue(CURRENT_TEST_CASE_COUNTRY_CODE_ID) || 'US'
    const locale = this.getValue(CURRENT_TEST_CASE_LOCALE_ID) || {locale: 'en-US', domain: 'com', currency: 'usd', currencySymbol: '$'}

    const testCaseExpected = this.getValue(CURRENT_TEST_CASE_EXPECTED_ID) || {instructions: [], ui: [], success: [], error: []}

    return (
      <div>
        <div className="row">
          <div className="col-xs-12 col-md-2 h5" style={{backgroundColor: '#d5dee8'}}>
            <div className="flex flex-column items-start p3">
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'retail')}>Retail</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'retailWithCoupon')}>Retail with coupon</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'pro')}>Pro</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'proWithCoupon')}>Pro with coupon</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'proWithReferral')}>Pro with referral</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'proExisting')}>Existing pro</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'proInternational')}>Pro international</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'posPro')}>POS pro</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'posProExisting')}>POS existing pro</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'posProManualPayment')}>POS pro - manual payment</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'posProManualShipping')}>POS pro - manual shipping</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'posProNet30')}>POS pro - net 30</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'posSample')}>POS sample</a>
              <a className="link-purplish mb1 border-bottom border-white" onClick={e => this.handleClick(e, 'updateBilling')}>Update billing</a>
            </div>
          </div>
          <div className="col-xs-12 col-md-6">
            <div className="row center-xs p2">
              <div className="col-xs-12 col-md-8" style={{textAlign: 'left'}}>
                <App
                  ready={ready}
                  rootState={rootState}
                  stripe={stripe}
                  locale={locale}
                  track={track}
                  countryCode={countryCode}
                  productDetails={productDetails}
                  shippingDetails={shippingDetails}
                  onProChargeSuccess={() => {console.log('onProChargeSuccess ran!')}}
                  onRetailChargeSuccess={() => {console.log('onRetailChargeSuccess ran!')}}
                  onScheduledChargeSuccess={() => {console.log('onScheduledChargeSuccess ran!')}}
                  onCreateCustomerSuccess={() => {console.log('onCreateCustomerSuccess ran!')}}
                  onSampleSuccess={() => {console.log('onSampleSuccess ran!')}}
                  prefill={prefill}
                  userProfile={userProfile}
                  customer={customer}
                  cartItems={cartItems}
                  isPos={isPos}
                  coupon={coupon}
                  updateBilling={updateBilling}
                />
              </div>
            </div>
          </div>
          <div className="col-xs-12 col-md-4" style={{backgroundColor: '#fff'}}>
            <div className="p3" style={{fontSize: '0.85rem'}}>
              <div className="bold">INSTRUCTIONS</div>
              <ul style={{marginLeft: '-20px'}}>
                {testCaseExpected.instructions.map((text, i) => {
                  return (
                    <li className="" key={i}>{text}</li>
                  )
                })}
              </ul>
              <div className="mt2 bold">EXPECTED UI</div>
              <ul style={{marginLeft: '-20px'}}>
                {testCaseExpected.ui.map((text, i) => {
                  return (
                    <li className="" key={i}>{text}</li>
                  )
                })}
              </ul>
              <div className="mt2 bold">EXPECTED SUCCESS RESPONSE</div>
              <ul style={{marginLeft: '-20px'}}>
                {testCaseExpected.success.map((text, i) => {
                  return (
                    <li className="" key={i}>{text}</li>
                  )
                })}
              </ul>
              <div className="mt2 bold">EXPECTED ERROR RESPONSE</div>
              <ul style={{marginLeft: '-20px'}}>
                {testCaseExpected.error.map((text, i) => {
                  return (
                    <li className="" key={i}>{text}</li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
