import React from 'react'
import R from 'ramda'
import {
  requiredValidator,
  emailValidator,
} from '../modules/validators/core'
import {changeState} from '../modules/state/events'
import {getElemState} from '../modules/state/core'
import {
  EMAIL_FIELD_ID,
  SHIPPING_ADDRESS_NAME_FIELD_ID,
  SHIPPING_ADDRESS_LINE1_FIELD_ID,
  SHIPPING_ADDRESS_ZIP_FIELD_ID,
  SHIPPING_ADDRESS_CITY_FIELD_ID,
  SHIPPING_ADDRESS_COUNTRY_FIELD_ID,
  BILLING_ADDRESS_NAME_FIELD_ID,
  BILLING_ADDRESS_LINE1_FIELD_ID,
  BILLING_ADDRESS_ZIP_FIELD_ID,
  BILLING_ADDRESS_CITY_FIELD_ID,
  BILLING_ADDRESS_COUNTRY_FIELD_ID,
  PHONE_FIELD_ID,
  OUTCOME_MESSAGE_ID,
} from '../modules/state/constants'
import availableCountries from '../modules/locale/available-countries.json'

import Select from 'react-select'

/*
  Props:
  {
    prefill: {
      name: '',
      email: '',
      countryCode: ''
    },
    onSuccess*: func(stripeCharge),
    onError*: func(error),
    currency*: 'usd',
    amount: 9000,
    style: {},
    btnStyle: {},
    className: '',
    stripeMetadata: {
      name: '',
      business_name: '',
      phone: '',
      couponId: '',
      products: '',
      quantity: '',
      line_items: [{sku: quantity}, ...],
    },
    update: false // just update billing info instead of charging
  }
*/

const App = React.createClass({
  getStripe() {
    const {stripeKey = 'pk_test_dzjZAkQ63whoQXIxplDnt77W'} = this.props
    return window.Stripe(stripeKey)
  },
  getCard() {
    const defaultCardStyle = {
      iconColor: '#666EE8',
      color: '#31325F',
      height: '44px',
      lineHeight: '44px',
      fontWeight: 300,
      fontFamily: 'Roboto, sans-serif',
      fontSize: '1rem',
      '::placeholder': {
        color: '#CFD7E0',
      },
    }

    const {cardStyle = defaultCardStyle} = this.props
    const stripe = this.getStripe()
    const elements = stripe.elements()

    const card = elements.create('card', {hidePostalCode: true, style: {base: cardStyle}})
    return card
  },
  getFieldValue(stateId) {
    const {rootState} = this.props
    return R.prop('value', getElemState(rootState, stateId))
  },
  getFieldValid(stateId) {
    const {rootState} = this.props
    return R.prop('valid', getElemState(rootState, stateId))
  },
  getFieldTouched(stateId) {
    const {rootState} = this.props
    return R.prop('touched', getElemState(rootState, stateId)) || false
  },
  getFieldError(stateId) {
    const {rootState} = this.props
    return R.prop('error', getElemState(rootState, stateId))
  },
  getValidatorMap() {
    return {
      [EMAIL_FIELD_ID]: [requiredValidator, emailValidator],
      [SHIPPING_ADDRESS_NAME_FIELD_ID]: [requiredValidator],
      [SHIPPING_ADDRESS_LINE1_FIELD_ID]: [requiredValidator],
      [SHIPPING_ADDRESS_ZIP_FIELD_ID]: [requiredValidator],
      [SHIPPING_ADDRESS_CITY_FIELD_ID]: [requiredValidator],
      [BILLING_ADDRESS_NAME_FIELD_ID]: [requiredValidator],
      [BILLING_ADDRESS_LINE1_FIELD_ID]: [requiredValidator],
      [BILLING_ADDRESS_ZIP_FIELD_ID]: [requiredValidator],
      [BILLING_ADDRESS_CITY_FIELD_ID]: [requiredValidator],
      [PHONE_FIELD_ID]: [requiredValidator],
    }
  },
  getAllValidatableFields() {
    return R.keys(this.getValidatorMap())
  },
  getValidators(stateId) {
    const validatorMap = this.getValidatorMap()
    return R.prop(stateId, validatorMap)
  },
  getFirstInvalidFieldId(allFieldsValid) {
    if (allFieldsValid) { return null }

    const {rootState} = this.props
    const validatableFieldStateIds = this.getAllValidatableFields()
    const firstInvalidFieldIndex = R.compose(R.findIndex(R.propEq('valid', false)), R.map(stateId => getElemState(rootState, stateId)))(validatableFieldStateIds)

    return firstInvalidFieldIndex === -1 ? R.head(validatableFieldStateIds) : R.prop(firstInvalidFieldIndex, validatableFieldStateIds)
  },
  getCountryList() {
    return R.compose(R.sortBy(R.prop('label')), R.map(pair => {
      const code = R.head(pair)
      const name = R.last(pair)
      return {value: code, label: name}
    }), R.toPairs)(availableCountries)
  },
  setOutcome(result) {

  },
  handleBlur(e, stateId) {
    const value = e.target.value
    const validators = this.getValidators(stateId) || []
    const validationResults = R.map(validator => validator(value))(validators) // [{valid: true, errorMsg: ''}, {valid: false, errorMsg: 'blah'}, ...]
    const valid = R.compose(R.all(R.equals(true)), R.pluck('valid'))(validationResults)
    const error = R.compose(R.head, R.reject(R.either(R.isNil, R.isEmpty)), R.pluck('errorMsg'))(validationResults) || ''
    const touched = true

    // console.log('On field blur', {value, valid, error, touched})
    changeState(stateId, {value, valid, error, touched})
  },
  handleSelectChange(value, stateId) {
    changeState(stateId, {value})
  },
  handleSubmit(e) {
    e.preventDefault()
    const {rootState} = this.props
    const card = this.getCard()
    const stripe = this.getStripe()

    const validatableFieldStateIds = this.getAllValidatableFields()
    const allFieldsValid = R.compose(R.all(R.equals(true)), R.map(stateId => R.prop('valid', getElemState(rootState, stateId))))(validatableFieldStateIds)

    if (!allFieldsValid) {
      // Show error message...
      const firstInvalidFieldId = this.getFirstInvalidFieldId(allFieldsValid)
      const errorMessage = R.prop('error', getElemState(rootState, firstInvalidFieldId)) || 'Please fill out all required fields.'
      changeState(OUTCOME_MESSAGE_ID, {value: errorMessage, visible: true})
      setTimeout(() => changeState(OUTCOME_MESSAGE_ID, {visible: false}), 2500)

      // Set touched state of all fields to false
      R.forEach(stateId => changeState(stateId, {touched: true}))(validatableFieldStateIds)

      // ...and then focus on the first invalid field
      document.getElementById(firstInvalidFieldId).focus()

      return
    }

    const extraDetails = {
      email: '',
      name: '',
      address_city: '',
      address_country: '',
      address_line1: '',
      address_state: '',
      address_zip: '',
      metadata: {
        phone: '',
        shipping_method: '',
        shipping_price: '',
        business_name: '',
        new: '',
        products: '',
        quantity: '',
        coupon_id: '',
      }
    }
    stripe.createToken(card, extraDetails).then(this.setOutcome)
  },
  componentDidMount() {
    // Attach Stripe Card Element
    const card = this.getCard()
    card.mount('#card-element')
    card.on('change', e => this.setOutcome(e))

    // initialize country fields
    const {prefill = {countryCode: 'US'}} = this.props
    const {countryCode} = prefill
    changeState(SHIPPING_ADDRESS_COUNTRY_FIELD_ID, {value: countryCode})
    changeState(BILLING_ADDRESS_COUNTRY_FIELD_ID, {value: countryCode})
  },
  render() {
    const {rootState} = this.props
    const countryList = this.getCountryList()
    const shippingCountryCode = this.getFieldValue(SHIPPING_ADDRESS_COUNTRY_FIELD_ID)
    const billingCountryCode = this.getFieldValue(BILLING_ADDRESS_COUNTRY_FIELD_ID)
    const outcomeVisible = R.prop('visible', getElemState(rootState, OUTCOME_MESSAGE_ID))
    const outcomeMsg = R.prop('value', getElemState(rootState, OUTCOME_MESSAGE_ID))

    return (
      <div className="zensa-checkout">
        <form className="form" onSubmit={this.handleSubmit} noValidate>

          <div className="form-group">
            <label className="label">
              <div className="row">
                <span className="col-xs-3">Email</span>
                <div className="col-xs-9">
                  <input
                    id={EMAIL_FIELD_ID}
                    onBlur={e => this.handleBlur(e, EMAIL_FIELD_ID)}
                    name="email"
                    autoComplete="home email"
                    className={`form-field ${this.getFieldValid(EMAIL_FIELD_ID) || !this.getFieldTouched(EMAIL_FIELD_ID) ? '' : 'form-field-error'}`}
                    placeholder="your@email.com"
                    type="email"
                  />
                </div>
              </div>
            </label>
          </div>

          {/* same shipping and billing info checkbox */}
          
          {/* end: same shipping and billing info checkbox */}

          {/* shipping info */}
          <div className="form-group transition">
            <label className="label">
              <div className="row">
                <span className="col-xs-3">Name</span>
                <div className="col-xs-9">
                  <input
                    id={SHIPPING_ADDRESS_NAME_FIELD_ID}
                    onBlur={e => this.handleBlur(e, SHIPPING_ADDRESS_NAME_FIELD_ID)}
                    name="cardholder-name"
                    autoComplete="home name"
                    className={`form-field ${this.getFieldValid(SHIPPING_ADDRESS_NAME_FIELD_ID) || !this.getFieldTouched(SHIPPING_ADDRESS_NAME_FIELD_ID) ? '' : 'form-field-error'}`}
                    placeholder="Jane Doe"
                  />
                </div>
              </div>
            </label>
            <label className="label">
              <div className="row">
                <span className="col-xs-3">Address</span>
                <div className="col-xs-9">
                  <input
                    id={SHIPPING_ADDRESS_LINE1_FIELD_ID}
                    onBlur={e => this.handleBlur(e, SHIPPING_ADDRESS_LINE1_FIELD_ID)}
                    className={`form-field ${this.getFieldValid(SHIPPING_ADDRESS_LINE1_FIELD_ID) || !this.getFieldTouched(SHIPPING_ADDRESS_LINE1_FIELD_ID) ? '' : 'form-field-error'}`}
                    placeholder="Unit # - Street Address"
                    type="text"
                  />
                </div>
              </div>
            </label>
            <label className="label">
              <div className="row">
                <div className="col-xs-3" style={{marginTop: '-1px', backgroundColor: '#fff'}}></div>
                <div className="col-xs-9">
                  <div className="row">
                    <div className="col-xs-5" style={{borderRight: '1px solid #F0F5FA'}}>
                      <input
                        id={SHIPPING_ADDRESS_ZIP_FIELD_ID}
                        onBlur={e => this.handleBlur(e, SHIPPING_ADDRESS_ZIP_FIELD_ID)}
                        name="address-zip"
                        className={`form-field ${this.getFieldValid(SHIPPING_ADDRESS_ZIP_FIELD_ID) || !this.getFieldTouched(SHIPPING_ADDRESS_ZIP_FIELD_ID) ? '' : 'form-field-error'}`}
                        placeholder="Postcode"
                        type="postalCode"
                      />
                    </div>
                    <div className="col-xs-7" style={{paddingLeft: '1rem'}}>
                      <input
                        id={SHIPPING_ADDRESS_CITY_FIELD_ID}
                        onBlur={e => this.handleBlur(e, SHIPPING_ADDRESS_CITY_FIELD_ID)}
                        name="address-city"
                        className={`form-field ${this.getFieldValid(SHIPPING_ADDRESS_CITY_FIELD_ID) || !this.getFieldTouched(SHIPPING_ADDRESS_CITY_FIELD_ID) ? '' : 'form-field-error'}`}
                        placeholder="City"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </label>
            <label className="label">
              <div className="row">
                <div className="col-xs-3" style={{marginTop: '-1px', backgroundColor: '#fff'}}></div>
                <div className="col-xs-9">
                  <Select
                    name="address-country"
                    className="form-field"
                    value={shippingCountryCode}
                    options={countryList}
                    clearable={false}
                    onChange={val => this.handleSelectChange(val, SHIPPING_ADDRESS_COUNTRY_FIELD_ID)}
                  />

                  {/*<input
                    id={SHIPPING_ADDRESS_COUNTRY_FIELD_ID}
                    onBlur={e => this.handleBlur(e, SHIPPING_ADDRESS_COUNTRY_FIELD_ID)}
                    name="address-country"
                    className="form-field"
                    placeholder="Country"
                    type="text"
                  />*/}
                  </div>
              </div>
            </label>
          </div>
          {/* end: shipping info */}

          {/* billing info */}
          <div className="form-group transition">
            <label className="label">
              <div className="row">
                <span className="col-xs-3">Name</span>
                <div className="col-xs-9">
                  <input
                    id={BILLING_ADDRESS_NAME_FIELD_ID}
                    onBlur={e => this.handleBlur(e, BILLING_ADDRESS_NAME_FIELD_ID)}
                    name="cardholder-name"
                    autoComplete="home name"
                    className={`form-field ${this.getFieldValid(BILLING_ADDRESS_NAME_FIELD_ID) || !this.getFieldTouched(BILLING_ADDRESS_NAME_FIELD_ID) ? '' : 'form-field-error'}`}
                    placeholder="Jane Doe"
                  />
                </div>
              </div>
            </label>
            <label className="label">
              <div className="row">
                <span className="col-xs-3">Address</span>
                <div className="col-xs-9">
                  <input
                    id={BILLING_ADDRESS_LINE1_FIELD_ID}
                    onBlur={e => this.handleBlur(e, BILLING_ADDRESS_LINE1_FIELD_ID)}
                    className={`form-field ${this.getFieldValid(BILLING_ADDRESS_LINE1_FIELD_ID) || !this.getFieldTouched(BILLING_ADDRESS_LINE1_FIELD_ID) ? '' : 'form-field-error'}`}
                    placeholder="Unit # - Street Address"
                    type="text"
                  />
                </div>
              </div>
            </label>
            <label className="label">
              <div className="row">
                <div className="col-xs-3" style={{marginTop: '-1px', backgroundColor: '#fff'}}></div>
                <div className="col-xs-9">
                  <div className="row">
                    <div className="col-xs-5" style={{borderRight: '1px solid #F0F5FA'}}>
                      <input
                        id={BILLING_ADDRESS_ZIP_FIELD_ID}
                        onBlur={e => this.handleBlur(e, BILLING_ADDRESS_ZIP_FIELD_ID)}
                        name="address-zip"
                        className={`form-field ${this.getFieldValid(BILLING_ADDRESS_ZIP_FIELD_ID) || !this.getFieldTouched(BILLING_ADDRESS_ZIP_FIELD_ID) ? '' : 'form-field-error'}`}
                        placeholder="Postcode"
                        type="postalCode"
                      />
                    </div>
                    <div className="col-xs-7" style={{paddingLeft: '1rem'}}>
                      <input
                        id={BILLING_ADDRESS_CITY_FIELD_ID}
                        onBlur={e => this.handleBlur(e, BILLING_ADDRESS_CITY_FIELD_ID)}
                        name="address-city"
                        className={`form-field ${this.getFieldValid(BILLING_ADDRESS_CITY_FIELD_ID) || !this.getFieldTouched(BILLING_ADDRESS_CITY_FIELD_ID) ? '' : 'form-field-error'}`}
                        placeholder="City"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </label>
            <label className="label">
              <div className="row">
                <div className="col-xs-3" style={{marginTop: '-1px', backgroundColor: '#fff'}}></div>
                <div className="col-xs-9">
                  <Select
                    name="address-country"
                    className="form-field"
                    value={shippingCountryCode}
                    options={countryList}
                    clearable={false}
                    onChange={val => this.handleSelectChange(val, BILLING_ADDRESS_COUNTRY_FIELD_ID)}
                  />

                  {/*<input
                    id={BILLING_ADDRESS_COUNTRY_FIELD_ID}
                    onBlur={e => this.handleBlur(e, BILLING_ADDRESS_COUNTRY_FIELD_ID)}
                    name="address-country"
                    className="form-field"
                    placeholder="Country"
                    type="text"
                  />*/}
                  </div>
              </div>
            </label>
          </div>
          {/* end: billing info */}

          <div className="form-group">
            <label className="label">
              <div className="row">
                <span className="col-xs-3">Phone</span>
                <div className="col-xs-9">
                  <input
                    id={PHONE_FIELD_ID}
                    onBlur={e => this.handleBlur(e, PHONE_FIELD_ID)}
                    name="phone"
                    autoComplete="home tel mobile"
                    className={`form-field ${this.getFieldValid(PHONE_FIELD_ID) || !this.getFieldTouched(PHONE_FIELD_ID) ? '' : 'form-field-error'}`}
                    placeholder="(123) 456-7890"
                    type="tel"
                  />
                </div>
              </div>
            </label>
          </div>

          <div className="form-group">
            <label className="label">
              <div className="row">
                <span className="col-xs-3">Card</span>
                <span className="col-xs-9"><div id="card-element" className="form-field"></div></span>
              </div>
            </label>
          </div>

          <button className="form-btn" type="submit">Pay $25</button>

          <div className="outcome">
            <div className="error" style={outcomeVisible ? {display: 'block'} : {display: 'none'}}>
              <span style={{fontSize: '0.8rem'}}>{outcomeMsg}</span>
            </div>
          </div>
        </form>
      </div>
    )
  }
})

export default App
