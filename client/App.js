import React, {Component} from 'react'
import PropTypes from 'prop-types'
import R from 'ramda'
import {convertToCurrency} from '../modules/global/core'
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
  SHIPPING_ADDRESS_STATE_FIELD_ID,
  SHIPPING_ADDRESS_COUNTRY_FIELD_ID,
  BILLING_ADDRESS_NAME_FIELD_ID,
  BILLING_ADDRESS_LINE1_FIELD_ID,
  BILLING_ADDRESS_ZIP_FIELD_ID,
  BILLING_ADDRESS_CITY_FIELD_ID,
  BILLING_ADDRESS_STATE_FIELD_ID,
  BILLING_ADDRESS_COUNTRY_FIELD_ID,
  PHONE_FIELD_ID,
  SHIPPING_METHOD_ID,
  SAME_SHIPPING_BILLING_CHECKBOX_ID,
  ADDRESS_TOGGLE_ID,
  PAY_BUTTON_ID,
  OUTCOME_MESSAGE_ID,
} from '../modules/state/constants'
import availableCountries from '../modules/locale/available-countries.json'
import locales from '../modules/locale/locales.json'
import {showPageLoading, hidePageLoading, showPageLoadingSuccess, hidePageLoadingSuccess} from '../modules/page-loading/core'
import {
  getDiscount,
  getReferralCredit,
  getSubtotal,
  getSalesTax,
  getShippingOptions,
  getShippingRate,
  getTotal,
} from '../modules/checkout/utils'
import {
  handleStripeOutcome,
  charge,
  chargeExistingPro,
  updateBilling,
} from '../modules/checkout/core'

import Select from 'react-select'

/*
  Props:
  {
    prefill: [
      {
        [stateId]: {
          value: 'blah',
        }
      }
      ...
    ],
    onSuccess*: func(stripeCharge),
    onError*: func(error),
    currency*: 'usd',
    amount: 9000,
    style: {},
    btnStyle: {},
    className: '',
    shippingMethods: [],
    stripeMetadata: {
      business_name: '',
      couponId: '',
      products: '',
      quantity: '',
      line_items: [{sku: quantity}, ...],
    },
    update: false, // just update billing info instead of charging
    updateEmail: '' // only if update === true
  }
*/

export default class App extends Component {
  static propTypes = {
    rootState: PropTypes.object.isRequired,
    stripe: PropTypes.object.isRequired,
    locale: PropTypes.object.isRequired,
    productDetails: PropTypes.array.isRequired,
    shippingDetails: PropTypes.array.isRequired,
    cartItems: PropTypes.object.isRequired,
    userProfile: PropTypes.object,
    customer: PropTypes.object,
    prefill: PropTypes.object,
    coupon: PropTypes.object,
    track: PropTypes.object,
    updateBilling: PropTypes.bool,
    showCartSummary: PropTypes.bool,
    addToEmailList: PropTypes.bool,
    isFreeSample: PropTypes.bool,
    isPos: PropTypes.bool,
    onChargeSuccess: PropTypes.func,
    btnStyle: PropTypes.object,
    btnClassName: PropTypes.string,
  }
  static defaultProps = {
    userProfile: null,
    customer: null,
    prefill: null,
    coupon: null,
    track: {},
    updateBilling: false,
    showCartSummary: true,
    addToEmailList: true,
    isFreeSample: false,
    isPos: false,
    onChargeSuccess: () => {},
    btnStyle: {},
    btnClassName: '',
  }

  constructor(props) {
    super(props)
  }

  getCard = () => {
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

    const {cardStyle = defaultCardStyle, stripe} = this.props
    const elements = stripe.elements()

    const card = elements.create('card', {hidePostalCode: true, style: {base: cardStyle}})
    return card
  }
  getValue = (stateId) => {
    const {rootState} = this.props
    return R.prop('value', getElemState(rootState, stateId))
  }
  getLabel = (stateId) => {
    const {rootState} = this.props
    return R.prop('label', getElemState(rootState, stateId))
  }
  getFieldValid = (stateId) => {
    const {rootState} = this.props
    return R.prop('valid', getElemState(rootState, stateId))
  }
  getFieldTouched = (stateId) => {
    const {rootState} = this.props
    return R.prop('touched', getElemState(rootState, stateId)) || false
  }
  getFieldError = (stateId) => {
    const {rootState} = this.props
    return R.prop('error', getElemState(rootState, stateId))
  }
  getShippingStateIds = () => {
    return [
      SHIPPING_ADDRESS_NAME_FIELD_ID,
      SHIPPING_ADDRESS_LINE1_FIELD_ID,
      SHIPPING_ADDRESS_ZIP_FIELD_ID,
      SHIPPING_ADDRESS_CITY_FIELD_ID,
    ]
  }
  getBillingStateIds = () => {
    return [
      BILLING_ADDRESS_NAME_FIELD_ID,
      BILLING_ADDRESS_LINE1_FIELD_ID,
      BILLING_ADDRESS_ZIP_FIELD_ID,
      BILLING_ADDRESS_CITY_FIELD_ID,
    ]
  }
  getValidatorMap = () => {
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
  }
  getAllValidatableFields = () => {
    // If same shipping and billing checkbox is clicked, don't validate the billing info - so take it out of validatable fields
    const sameShippingBillingChecked = this.getValue(SAME_SHIPPING_BILLING_CHECKBOX_ID)
    return sameShippingBillingChecked ? R.without(this.getBillingStateIds(), R.keys(this.getValidatorMap())) : R.keys(this.getValidatorMap())
  }
  getValidators = (stateId) => {
    const validatorMap = this.getValidatorMap()
    return R.prop(stateId, validatorMap)
  }
  getFirstInvalidFieldId = (allFieldsValid) => {
    if (allFieldsValid) { return null }

    const {rootState} = this.props
    const validatableFieldStateIds = this.getAllValidatableFields()
    const firstInvalidFieldIndex = R.compose(R.findIndex(R.either(R.propEq('valid', false), R.propEq('valid', undefined))), R.map(stateId => getElemState(rootState, stateId)))(validatableFieldStateIds)

    return firstInvalidFieldIndex === -1 ? R.head(validatableFieldStateIds) : R.prop(firstInvalidFieldIndex, validatableFieldStateIds)
  }
  getCountryList = () => {
    return R.compose(R.sortBy(R.prop('label')), R.map(pair => {
      const code = R.head(pair)
      const name = R.last(pair)
      return {value: code, label: name}
    }), R.toPairs)(availableCountries)
  }
  copyShippingToBilling = () => {
    // Copy on: same shipping and billing checkbox click
    const {rootState} = this.props
    const shippingStateIds = this.getShippingStateIds()
    const billingStateIds = this.getBillingStateIds()

    const forEachIndexed = R.addIndex(R.forEach)
    forEachIndexed((shippingStateId, i) => {
      const value = R.prop('value', getElemState(rootState, shippingStateId))

      // only copy if the value is not empty and set valid/touched state too
      changeState(billingStateIds[i], {value})
    },shippingStateIds)
  }
  getFormData = () => {
    return {
      email: this.getValue(EMAIL_FIELD_ID),
      shippingAddress: {
        name: this.getValue(SHIPPING_ADDRESS_NAME_FIELD_ID),
        line1: this.getValue(SHIPPING_ADDRESS_LINE1_FIELD_ID),
        city: this.getValue(SHIPPING_ADDRESS_ZIP_FIELD_ID),
        state: this.getValue(SHIPPING_ADDRESS_CITY_FIELD_ID),
        zip: this.getValue(SHIPPING_ADDRESS_STATE_FIELD_ID),
        country: this.getValue(SHIPPING_ADDRESS_COUNTRY_FIELD_ID),
      },
      billingAddress: {
        name: this.getValue(BILLING_ADDRESS_NAME_FIELD_ID),
        line1: this.getValue(BILLING_ADDRESS_LINE1_FIELD_ID),
        city: this.getValue(BILLING_ADDRESS_ZIP_FIELD_ID),
        state: this.getValue(BILLING_ADDRESS_CITY_FIELD_ID),
        zip: this.getValue(BILLING_ADDRESS_STATE_FIELD_ID),
        country: this.getValue(BILLING_ADDRESS_COUNTRY_FIELD_ID),
      },
      phone: this.getValue(PHONE_FIELD_ID),
      shippingMethod: this.getValue(SHIPPING_METHOD_ID),
    }
  }

  handleBlur = (e, stateId) => {
    const value = e.target.value
    const validators = this.getValidators(stateId) || []
    const validationResults = R.map(validator => validator(value))(validators) // [{valid: true, errorMsg: ''}, {valid: false, errorMsg: 'blah'}, ...]
    const valid = R.compose(R.all(R.equals(true)), R.pluck('valid'))(validationResults)
    const error = R.compose(R.head, R.reject(R.either(R.isNil, R.isEmpty)), R.pluck('errorMsg'))(validationResults) || ''
    const touched = true

    // console.log('On field blur', {value, valid, error, touched})
    changeState(stateId, {value, valid, error, touched})
  }
  handleChange = (e, stateId) => {
    const value = e.target.value

    // Get rid of error message on any input change
    changeState(OUTCOME_MESSAGE_ID, {visible: false})

    changeState(stateId, {value})
  }
  handleSelectChange = (value, stateId) => {
    changeState(stateId, {value})

    // Get rid of error message on any input change
    changeState(OUTCOME_MESSAGE_ID, {visible: false})
  }
  handleCheckboxChange = (e) => {
    const value = e.target.checked
    changeState(SAME_SHIPPING_BILLING_CHECKBOX_ID, {value})
    this.copyShippingToBilling()
  }
  handleAddressToggleClick = (value) => {
    changeState(ADDRESS_TOGGLE_ID, {value})
  }
  handleRadioButtonChange = (e, stateId) => {
    const value = e.target.value
    changeState(SHIPPING_METHOD_ID, {value})
  }
  handleSubmit = (e) => {
    e.preventDefault()

    // disable the button and show pageloading
    changeState(PAY_BUTTON_ID, {disabled: false})
    showPageLoading()

    const {rootState, stripe, currency, track} = this.props
    const card = this.getCard()

    // Field validation
    const validatableFieldStateIds = this.getAllValidatableFields()
    const allFieldsValid = R.compose(R.all(R.equals(true)), R.map(stateId => R.prop('valid', getElemState(rootState, stateId))))(validatableFieldStateIds)

    if (!allFieldsValid) {
      console.log('At least one field invalid')

      // Show error message...
      const firstInvalidFieldId = this.getFirstInvalidFieldId(allFieldsValid)
      const errorText = this.getFieldError(firstInvalidFieldId) || 'Please fill out all required fields.'

      // Set touched state of all fields to true
      R.forEach(stateId => changeState(stateId, {touched: true}))(validatableFieldStateIds)

      // ...and then focus on the first invalid field
      document.getElementById(firstInvalidFieldId).focus()

      this.handleSubmitError({errorText})

      return
    }

    console.log('No field validation errors')
    const formData = this.getFormData()

    // track checkout button click
    track.checkout()

    // show page loading
    showPageLoading()

    // create customer and charge
  }
  handleSubmitError = (err) => {
    console.log('Something went wrong while processing payment: ', err)
    hidePageLoading()
    changeState(PAY_BUTTON_ID, {disabled: false})
    const getErrorText = () => err.errorText ? err.errorText : 'Something went wrong while signing you up. Please try again later.'
    changeState(OUTCOME_MESSAGE_ID, {msg: getErrorText(), type: 'error', visible: true})
  }

  componentDidMount() {
    // Attach Stripe Card Element
    const card = this.getCard()
    card.mount('#card-element')
    card.on('change', e => {
      // Get rid of error message on any input change
      changeState(OUTCOME_MESSAGE_ID, {visible: false})

      handleStripeOutcome(e)
    })

    // Initialize states
    const {countryCode = 'US', shippingMethods} = this.props
    changeState(SHIPPING_ADDRESS_COUNTRY_FIELD_ID, {value: countryCode})
    changeState(BILLING_ADDRESS_COUNTRY_FIELD_ID, {value: countryCode})
    changeState(SAME_SHIPPING_BILLING_CHECKBOX_ID, {value: true})
    changeState(ADDRESS_TOGGLE_ID, {value: 'shipping'})
    changeState(SHIPPING_METHOD_ID, {value: R.path([0, 'name'], shippingMethods)})

    // Initialize labels and error messages (for required validator only since by default it'll be empty)
    changeState(EMAIL_FIELD_ID, {label: 'Email', error: 'Please fill out the email'})
    changeState(SHIPPING_ADDRESS_NAME_FIELD_ID, {label: 'Name', error: 'Please fill out the name'})
    changeState(SHIPPING_ADDRESS_LINE1_FIELD_ID, {label: 'Address', error: 'Please fill out the street address'})
    changeState(SHIPPING_ADDRESS_ZIP_FIELD_ID, {label: '', error: 'Please fill out the postcode'})
    changeState(SHIPPING_ADDRESS_CITY_FIELD_ID, {label: '', error: 'Please fill out the city'})
    changeState(SHIPPING_ADDRESS_COUNTRY_FIELD_ID, {label: '', error: 'Please fill out the country'})
    changeState(BILLING_ADDRESS_NAME_FIELD_ID, {label: 'Address', error: 'Please fill out the name'})
    changeState(BILLING_ADDRESS_LINE1_FIELD_ID, {label: '', error: 'Please fill out the street address'})
    changeState(BILLING_ADDRESS_ZIP_FIELD_ID, {label: '', error: 'Please fill out the postcode'})
    changeState(BILLING_ADDRESS_CITY_FIELD_ID, {label: '', error: 'Please fill out the city'})
    changeState(BILLING_ADDRESS_COUNTRY_FIELD_ID, {label: '', error: 'Please fill out the country'})
    changeState(PHONE_FIELD_ID, {label: 'Phone', error: 'Please fill out the phone'})
    changeState(SHIPPING_METHOD_ID, {label: 'Shipping'})
  }

  render() {
    const {rootState, locale, userProfile, shippingDetails, btnStyle = {}, btnClassName = ''} = this.props
    const {currency, currencySymbol} = locale
    const countryList = this.getCountryList()
    const shippingCountryCode = this.getValue(SHIPPING_ADDRESS_COUNTRY_FIELD_ID)
    const billingCountryCode = this.getValue(BILLING_ADDRESS_COUNTRY_FIELD_ID)
    const outcomeMessageVisible = R.prop('visible', getElemState(rootState, OUTCOME_MESSAGE_ID))
    const outcomeMessageType = R.prop('type', getElemState(rootState, OUTCOME_MESSAGE_ID))
    const outcomeMessage = R.prop('msg', getElemState(rootState, OUTCOME_MESSAGE_ID))
    const sameShippingBillingChecked = this.getValue(SAME_SHIPPING_BILLING_CHECKBOX_ID)
    const addressToggleState = this.getValue(ADDRESS_TOGGLE_ID)
    const shippingOptions = getShippingOptions(userProfile, shippingDetails)

    const total = getTotal(this.props, )

    const emailLabel = this.getLabel(EMAIL_FIELD_ID)
    const shippingNameLabel = this.getLabel(SHIPPING_ADDRESS_NAME_FIELD_ID)
    const shippingAddressLine1Label = this.getLabel(SHIPPING_ADDRESS_LINE1_FIELD_ID)
    const billingNameLabel = this.getLabel(BILLING_ADDRESS_NAME_FIELD_ID)
    const billingAddressLine1Label = this.getLabel(BILLING_ADDRESS_LINE1_FIELD_ID)
    const phoneLabel = this.getLabel(PHONE_FIELD_ID)
    const shippingMethodLabel = this.getLabel(SHIPPING_METHOD_ID)

    return (
      <div className="zensa-checkout" style={{textAlign: 'left', justifyContent: 'start'}}>
        {/* outcome notification */}
        <div className={`fixed rounded h5 ${outcomeMessageType === 'error' ? 'bg-soft-red' : 'bg-dark-green'} white center transition-bottom z3 ${outcomeMessageVisible ? 'show-up' : 'hide-down'}`} style={{top: '0.5rem', left: '0.5rem', right: '0.5rem', padding: '0.3rem 0.5rem'}}>
          {outcomeMessage}
        </div>
        {/* end: outcome notification */}

        <form className="form" onSubmit={this.handleSubmit} noValidate>

          <div className="form-group">
            <div className="label">
              <div className="row">
                <span className="col-xs-3">{emailLabel}</span>
                <div className="col-xs-9">
                  <input
                    id={EMAIL_FIELD_ID}
                    onChange={e => this.handleChange(e, EMAIL_FIELD_ID)}
                    onBlur={e => this.handleBlur(e, EMAIL_FIELD_ID)}
                    name="email"
                    autoComplete="home email"
                    className={`form-field ${this.getFieldValid(EMAIL_FIELD_ID) || !this.getFieldTouched(EMAIL_FIELD_ID) ? '' : 'form-field-error'}`}
                    placeholder="your@email.com"
                    type="email"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* same shipping and billing info checkbox */}
          <div style={{marginBottom: '5px', marginTop: '-8px', fontSize: '0.8rem', color: 'rgba(0,0,0,0.25)', display: `${sameShippingBillingChecked ? 'block' : 'none'}`}}>
            <input
              type="checkbox"
              value={this.getValue(SAME_SHIPPING_BILLING_CHECKBOX_ID)}
              checked={sameShippingBillingChecked}
              onChange={this.handleCheckboxChange}
              tabIndex="-1"
            />&nbsp;<span>Same shipping & billing info</span>
          </div>
          {/* end: same shipping and billing info checkbox */}

          {/* shipping and billing toggle */}
          <div style={{display: `${sameShippingBillingChecked ? 'none' : 'block'}`}}>
            <div className="row">
              <div className="col-xs-6" style={{paddingRight: '0px'}}>
                <div onClick={e => this.handleAddressToggleClick('shipping')} className={`shipping-billing-toggle shipping-billing-toggle-left ${addressToggleState === 'shipping' ? 'toggleSelected' : ''}`}>Shipping</div>
              </div>
              <div className="col-xs-6" style={{paddingLeft: '0px'}}>
                <div onClick={e => this.handleAddressToggleClick('billing')} className={`shipping-billing-toggle shipping-billing-toggle-right ${addressToggleState === 'billing' ? 'toggleSelected' : ''}`}>Billing</div>
              </div>
            </div>
          </div>
          {/* end: shipping and billing toggle */}

          <div style={{position: 'relative', zIndex: '2', height: '200px'}}>

            {/* shipping info */}
            <div style={{position: 'absolute', width: '100%'}} className={`transition-left show ${addressToggleState === 'billing' ? 'hide' : ''}`}>
              <div className={`form-group`}>
                <div className="label">
                  <div className="row">
                    <span className="col-xs-3">{shippingNameLabel}</span>
                    <div className="col-xs-9">
                      <input
                        id={SHIPPING_ADDRESS_NAME_FIELD_ID}
                        value={this.getValue(SHIPPING_ADDRESS_NAME_FIELD_ID)}
                        onChange={e => this.handleChange(e, SHIPPING_ADDRESS_NAME_FIELD_ID)}
                        onBlur={e => this.handleBlur(e, SHIPPING_ADDRESS_NAME_FIELD_ID)}
                        name="cardholder-name"
                        autoComplete="home name"
                        className={`form-field ${this.getFieldValid(SHIPPING_ADDRESS_NAME_FIELD_ID) || !this.getFieldTouched(SHIPPING_ADDRESS_NAME_FIELD_ID) ? '' : 'form-field-error'}`}
                        placeholder="Jane Doe"
                      />
                    </div>
                  </div>
                </div>
                <div className="label">
                  <div className="row">
                    <span className="col-xs-3">{shippingAddressLine1Label}</span>
                    <div className="col-xs-9">
                      <input
                        id={SHIPPING_ADDRESS_LINE1_FIELD_ID}
                        value={this.getValue(SHIPPING_ADDRESS_LINE1_FIELD_ID)}
                        onChange={e => this.handleChange(e, SHIPPING_ADDRESS_LINE1_FIELD_ID)}
                        onBlur={e => this.handleBlur(e, SHIPPING_ADDRESS_LINE1_FIELD_ID)}
                        className={`form-field ${this.getFieldValid(SHIPPING_ADDRESS_LINE1_FIELD_ID) || !this.getFieldTouched(SHIPPING_ADDRESS_LINE1_FIELD_ID) ? '' : 'form-field-error'}`}
                        placeholder="Unit # - Street Address"
                        type="text"
                      />
                    </div>
                  </div>
                </div>
                <div className="label">
                  <div className="row">
                    <div className="col-xs-3" style={{marginTop: '-1px', backgroundColor: '#fff'}}></div>
                    <div className="col-xs-9">
                      <div className="row">
                        <div className="col-xs-5" style={{borderRight: '1px solid #F0F5FA'}}>
                          <input
                            id={SHIPPING_ADDRESS_ZIP_FIELD_ID}
                            value={this.getValue(SHIPPING_ADDRESS_ZIP_FIELD_ID)}
                            onChange={e => this.handleChange(e, SHIPPING_ADDRESS_ZIP_FIELD_ID)}
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
                            value={this.getValue(SHIPPING_ADDRESS_CITY_FIELD_ID)}
                            onChange={e => this.handleChange(e, SHIPPING_ADDRESS_CITY_FIELD_ID)}
                            onBlur={e => this.handleBlur(e, SHIPPING_ADDRESS_CITY_FIELD_ID)}
                            name="address-city"
                            className={`form-field ${this.getFieldValid(SHIPPING_ADDRESS_CITY_FIELD_ID) || !this.getFieldTouched(SHIPPING_ADDRESS_CITY_FIELD_ID) ? '' : 'form-field-error'}`}
                            placeholder="City"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="label">
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
                </div>
              </div>
            </div>
            {/* end: shipping info */}

            {/* billing info */}
            <div style={{position: 'absolute', width: '100%'}} className={`transition-right ${addressToggleState === 'billing' ? 'show' : ''}`}>
              <div className={`form-group`}>
                <div className="label">
                  <div className="row">
                    <span className="col-xs-3">{billingNameLabel}</span>
                    <div className="col-xs-9">
                      <input
                        id={BILLING_ADDRESS_NAME_FIELD_ID}
                        value={this.getValue(BILLING_ADDRESS_NAME_FIELD_ID)}
                        onChange={e => this.handleChange(e, BILLING_ADDRESS_NAME_FIELD_ID)}
                        onBlur={e => this.handleBlur(e, BILLING_ADDRESS_NAME_FIELD_ID)}
                        name="cardholder-name"
                        autoComplete="home name"
                        className={`form-field ${this.getFieldValid(BILLING_ADDRESS_NAME_FIELD_ID) || !this.getFieldTouched(BILLING_ADDRESS_NAME_FIELD_ID) ? '' : 'form-field-error'}`}
                        placeholder="Jane Doe"
                      />
                    </div>
                  </div>
                </div>
                <div className="label">
                  <div className="row">
                    <span className="col-xs-3">{billingAddressLine1Label}</span>
                    <div className="col-xs-9">
                      <input
                        id={BILLING_ADDRESS_LINE1_FIELD_ID}
                        value={this.getValue(BILLING_ADDRESS_LINE1_FIELD_ID)}
                        onChange={e => this.handleChange(e, BILLING_ADDRESS_LINE1_FIELD_ID)}
                        onBlur={e => this.handleBlur(e, BILLING_ADDRESS_LINE1_FIELD_ID)}
                        className={`form-field ${this.getFieldValid(BILLING_ADDRESS_LINE1_FIELD_ID) || !this.getFieldTouched(BILLING_ADDRESS_LINE1_FIELD_ID) ? '' : 'form-field-error'}`}
                        placeholder="Unit # - Street Address"
                        type="text"
                      />
                    </div>
                  </div>
                </div>
                <div className="label">
                  <div className="row">
                    <div className="col-xs-3" style={{marginTop: '-1px', backgroundColor: '#fff'}}></div>
                    <div className="col-xs-9">
                      <div className="row">
                        <div className="col-xs-5" style={{borderRight: '1px solid #F0F5FA'}}>
                          <input
                            id={BILLING_ADDRESS_ZIP_FIELD_ID}
                            value={this.getValue(BILLING_ADDRESS_ZIP_FIELD_ID)}
                            onChange={e => this.handleChange(e, BILLING_ADDRESS_ZIP_FIELD_ID)}
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
                            value={this.getValue(BILLING_ADDRESS_CITY_FIELD_ID)}
                            onChange={e => this.handleChange(e, BILLING_ADDRESS_CITY_FIELD_ID)}
                            onBlur={e => this.handleBlur(e, BILLING_ADDRESS_CITY_FIELD_ID)}
                            name="address-city"
                            className={`form-field ${this.getFieldValid(BILLING_ADDRESS_CITY_FIELD_ID) || !this.getFieldTouched(BILLING_ADDRESS_CITY_FIELD_ID) ? '' : 'form-field-error'}`}
                            placeholder="City"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="label">
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
                </div>
              </div>
            </div>
            {/* end: billing info */}

          </div>

          <div className="form-group">
            <div className="label">
              <div className="row">
                <span className="col-xs-3">{phoneLabel}</span>
                <div className="col-xs-9">
                  <input
                    id={PHONE_FIELD_ID}
                    value={this.getValue(PHONE_FIELD_ID)}
                    onChange={e => this.handleChange(e, PHONE_FIELD_ID)}
                    onBlur={e => this.handleBlur(e, PHONE_FIELD_ID)}
                    name="phone"
                    autoComplete="home tel mobile"
                    className={`form-field ${this.getFieldValid(PHONE_FIELD_ID) || !this.getFieldTouched(PHONE_FIELD_ID) ? '' : 'form-field-error'}`}
                    placeholder="(123) 456-7890"
                    type="tel"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* shipping methods */}
          <div className="form-group">
            {shippingOptions.map((method, i) => {
              const {title, name, deliverySpeed, price} = method
              const localPrice = R.prop(currency, price)
              const displayedPrice = localPrice === 0 ? 'Free' : convertToCurrency('', localPrice)

              return (
                <div className="label label-lg" key={i}>
                  <div className="row">
                    {i === 0 ? <span className="col-xs-3">{shippingMethodLabel}</span> : <span className="col-xs-3" style={{marginTop: '-1px', backgroundColor: '#fff'}}></span>}
                    <div className="col-xs-9">
                      <div className="flex items-center justify-start" style={{height: '60px'}}>
                        <input
                          type="radio"
                          name="shippingMethods"
                          value={name}
                          checked={this.getValue(SHIPPING_METHOD_ID) === name}
                          onChange={e => this.handleRadioButtonChange(e, SHIPPING_METHOD_ID)}
                          className={`form-field`}
                          style={{width: '24px', marginLeft: '-2px', flexShrink: '0', cursor: 'pointer'}}
                        />
                        <div style={{fontSize: '0.8rem', lineHeight: '1.2rem', color: '#222', fontWeight: '300', cursor: 'pointer'}}>
                          <div>{title} ({displayedPrice})</div>
                          <div style={{opacity: '0.4'}}>{deliverySpeed}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {/* end: shipping methods */}

          <div className="form-group">
            <div className="label">
              <div className="row">
                <span className="col-xs-3">Card</span>
                <span className="col-xs-9"><div id="card-element" className="form-field"></div></span>
              </div>
            </div>
          </div>

          <button className={`form-btn mb2 ${btnClassName}`} type="submit" style={btnStyle}>Pay {currencySymbol}{convertToCurrency(currencySymbol, total)}</button>
        </form>
      </div>
    )
  }
}
