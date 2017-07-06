import React, {Component} from 'react'
import PropTypes from 'prop-types'
import R from 'ramda'
import {convertToCurrency} from '../modules/global/core'
import {SAMPLE_PACK_SKU} from '../modules/global/constants'
import {
  requiredValidator,
  emailValidator,
} from '../modules/validators/core'
import {changeState} from '../modules/state/events'
import {getElemState} from '../modules/state/core'
import {
  STRIPE_CARD_ID,
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
  PAYMENT_METHOD_ID,
  PAYMENT_TERM_FIELD_ID,
  SAME_SHIPPING_BILLING_CHECKBOX_ID,
  ADDRESS_TOGGLE_ID,
  PAY_BUTTON_ID,
  OUTCOME_MESSAGE_ID,
} from '../modules/state/constants'
import availableCountries from '../modules/locale/available-countries.json'
import locales from '../modules/locale/locales.json'
import {showPageLoading, hidePageLoading, showPageLoadingSuccess, hidePageLoadingSuccess} from '../modules/page-loading/core'
import {
  checkIsFreeSample,
  checkIsPro,
  getCartItemsWithDetail,
  getDiscount,
  getReferralCredit,
  getSubtotal,
  getSalesTax,
  getShippingOptions,
  getShippingRate,
  getTotal,
  getFullAddressFromStateValues,
  getStateFromFullAddress$$,
  resetAllFields,
  getPaymentMethods,
} from '../modules/checkout/utils'
import {
  handleStripeOutcome,
  processSample,
  chargeManual,
  chargeLater,
  charge,
  chargeExistingPro,
  updateBilling,
} from '../modules/checkout/core'

import Select from 'react-select'
import Collapsible from 'react-collapsible'
import PageLoading from './components/PageLoading'
import CartSummary from './components/CartSummary'

export default class App extends Component {
  static propTypes = {
    ready: PropTypes.bool.isRequired, // required because of async vars; true when all async vars have been set
    rootState: PropTypes.object.isRequired,
    stripe: PropTypes.object.isRequired, // Different for website & POS
    locale: PropTypes.object.isRequired, // ASYNC; {locale, domain, currency, currencySymbol}
    productDetails: PropTypes.array.isRequired, // ASYNC
    shippingDetails: PropTypes.array.isRequired, // ASYNC
    cartItems: PropTypes.object.isRequired, // {627843518167: 1, ...}
    track: PropTypes.object.isRequired, // ASYNC; Mixpanel, FB pixel
    countryCode: PropTypes.string, // ASYNC
    userProfile: PropTypes.object, // ASYNC; this could be 1) from website or 2) from sales team (i.e. BaseCRM)
    customer: PropTypes.object, // ASYNC
    prefill: PropTypes.array, // ASYNC; [{stateId: 'zcoEmailField', value: 'test@test.com'}, ...]
    coupon: PropTypes.object, // {couponId, discount, applyTo, oneTimeUse, type, validUntil}
    updateBilling: PropTypes.bool,
    showCartSummary: PropTypes.bool,
    addToEmailList: PropTypes.bool,
    isPos: PropTypes.bool,
    onChargeSuccess: PropTypes.func,
    onScheduledChargeSuccess: PropTypes.func,
    onCreateCustomerSuccess: PropTypes.func,
    btnStyle: PropTypes.object,
    btnClassName: PropTypes.string,
  }
  static defaultProps = {
    countryCode: 'US',
    userProfile: null,
    customer: null,
    prefill: [],
    coupon: {},
    updateBilling: false,
    showCartSummary: true,
    addToEmailList: true,
    isPos: false,
    onChargeSuccess: () => {},
    onCreateCustomerSuccess: () => {},
    onScheduledChargeSuccess: () => {},
    btnStyle: {},
    btnClassName: '',
  }

  constructor(props) {
    super(props)
  }

  getCard = () => {
    const {rootState} = this.props
    return getElemState(rootState, STRIPE_CARD_ID)
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
        zip: this.getValue(SHIPPING_ADDRESS_ZIP_FIELD_ID),
        city: this.getValue(SHIPPING_ADDRESS_CITY_FIELD_ID),
        state: this.getValue(SHIPPING_ADDRESS_STATE_FIELD_ID),
        country: this.getValue(SHIPPING_ADDRESS_COUNTRY_FIELD_ID),
      },
      billingAddress: {
        name: this.getValue(BILLING_ADDRESS_NAME_FIELD_ID),
        line1: this.getValue(BILLING_ADDRESS_LINE1_FIELD_ID),
        zip: this.getValue(BILLING_ADDRESS_ZIP_FIELD_ID),
        city: this.getValue(BILLING_ADDRESS_CITY_FIELD_ID),
        state: this.getValue(BILLING_ADDRESS_STATE_FIELD_ID),
        country: this.getValue(BILLING_ADDRESS_COUNTRY_FIELD_ID),
      },
      phone: this.getValue(PHONE_FIELD_ID),
      shippingMethod: this.getValue(SHIPPING_METHOD_ID),
      paymentMethod: this.getValue(PAYMENT_METHOD_ID),
      paymentTerm: this.getValue(PAYMENT_TERM_FIELD_ID),
    }
  }
  lookUpState = (stateId) => {
    /**
     * Handles getting the state from Google based on full address
     * Only runs under these conditions:
     *    1) On blur (or change for Select) of any address related fields
     *    2) Only if all address related fields are filled out
     * NOTE: this needs to run on blur/select-change instead of button click
     *       because sales tax calculation will later require stateCode
     */

    const {rootState} = this.props

    // Strip out the name and add country from billing and shipping states for the state lookup
    const billingAddressStateIds = R.compose(R.append(BILLING_ADDRESS_COUNTRY_FIELD_ID), R.without(BILLING_ADDRESS_NAME_FIELD_ID))(this.getBillingStateIds())
    const shippingAddressStateIds = R.compose(R.append(SHIPPING_ADDRESS_COUNTRY_FIELD_ID), R.without(SHIPPING_ADDRESS_NAME_FIELD_ID))(this.getShippingStateIds())
    const isBillingAddressField = R.contains(stateId, billingAddressStateIds)
    const isShippingAddressField = R.contains(stateId, shippingAddressStateIds)

    // #1: If not billing or shipping related field, return
    if (!(isBillingAddressField || isShippingAddressField)) { return }

    // #2: If all address related fields are not filled out (and valid), return
    const checkFieldsFilledOut = R.compose(R.not, R.contains(false), R.map(stateId => {
      const value = this.getValue(stateId)
      const valid = this.getFieldValid(stateId)
      return !(R.isNil(value) || R.isEmpty(value)) && valid
    }))
    const allAddressFieldFilledOut = isBillingAddressField ? checkFieldsFilledOut(billingAddressStateIds) : checkFieldsFilledOut(shippingAddressStateIds)
    if (!allAddressFieldFilledOut) { return }

    const getStateValues = R.map(R.compose(R.prop('value'), getElemState(rootState)))
    // getAdjustedStateValues will change countryCode to countryName (necessary for Google look up)
    const getAdjustedStateValues = (addressStateIds, countryStateId) => R.compose(R.append(this.getLabel(countryStateId)), getStateValues)(R.without(countryStateId, addressStateIds))
    const addressStateValues = isBillingAddressField ? getAdjustedStateValues(billingAddressStateIds, BILLING_ADDRESS_COUNTRY_FIELD_ID) : getAdjustedStateValues(shippingAddressStateIds, SHIPPING_ADDRESS_COUNTRY_FIELD_ID)
    const fullAddress = getFullAddressFromStateValues(addressStateValues)
    getStateFromFullAddress$$(fullAddress).subscribe(
      state => {
        if (isBillingAddressField) {
          changeState(BILLING_ADDRESS_STATE_FIELD_ID, {value: state, valid: true})
        } else {
          changeState(SHIPPING_ADDRESS_STATE_FIELD_ID, {value: state, valid: true})
        }
      },
      err => {
        console.log('Something went wrong while getting state from Google: ', err)
        if (isBillingAddressField) {
          changeState(BILLING_ADDRESS_STATE_FIELD_ID, {value: null, valid: true})
        } else {
          changeState(SHIPPING_ADDRESS_STATE_FIELD_ID, {value: null, valid: true})
        }
      }
    )
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

    // Look up state
    this.lookUpState(stateId)
  }
  handleChange = (e, stateId) => {
    const value = e.target.value

    // Get rid of error message on any input change
    changeState(OUTCOME_MESSAGE_ID, {visible: false})

    changeState(stateId, {value})
  }
  handleSelectChange = (value, label, stateId) => {
    // Get rid of error message on any input change
    changeState(OUTCOME_MESSAGE_ID, {visible: false})

    changeState(stateId, {value, label})

    // Look up state
    this.lookUpState(stateId)
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
    changeState(PAY_BUTTON_ID, {disabled: true})
    showPageLoading()

    const {rootState, stripe, currency, track, userProfile, customer, updateBilling} = this.props
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

    // Show page loading
    showPageLoading()

    // Track checkout button click
    track.checkout()

    /**
     * Create customer and charge based on checkout type.
     * Checkout types:
     *    1) Sample (processSample())
     *    2) Update billing (updateBilling())
     *    3) Retail (charge())
     *    4) Pro manual (chargeManual())
     *    5) Pro with payment term (chargeLater())
     *    6) Pro immediate - new (charge())
     *    7) Pro immediate - existing (chargeExistingPro())
     */
    const formData = this.getFormData()
    // console.log('formData', formData)
    const {paymentMethod = 'cc', paymentTerm = 0} = formData
    const isFreeSample = checkIsFreeSample(this.props)
    const isManualPayment = paymentMethod === 'manual'
    const hasPaymentTerm = paymentTerm !== 0
    const isPro = checkIsPro(this.props)
    const isExistingCustomer = !R.isNil(customer)

    // #1 process sample
    if (isFreeSample) {
      processSample(this.props, formData)
      return
    }

    // #2 update billing
    if (updateBilling) {
      updateBilling(this.props, formData, card)
      return
    }

    // #3 Retail
    if (!isPro) {
      charge(this.props, formData, card)
      return
    }

    // #4 Pro manual
    if (isManualPayment) {
      chargeManual(this.props, formData)
      return
    }

    // #5 Has a payment term - schedule charge
    if (hasPaymentTerm) {
      chargeLater(this.props, formData, card)
      return
    }

    // #6 Pro immediate - new
    if (!isExistingCustomer) {
      charge(this.props, formData, card)
      return
    }

    // #7 Pro immediate - existing
    chargeExistingPro(this.props, formData)
    return
  }
  handleSubmitError = (err) => {
    console.log('Something went wrong while processing payment: ', err)
    hidePageLoading()
    changeState(PAY_BUTTON_ID, {disabled: false})
    const getErrorText = () => err.errorText ? err.errorText : 'Something went wrong while signing you up. Please try again later.'
    changeState(OUTCOME_MESSAGE_ID, {msg: getErrorText(), type: 'error', visible: true})
  }

  // Handle async initializations here
  componentDidUpdate(prevProps) {
    const {ready, userProfile, shippingDetails, countryCode} = this.props

    // Initialize async states when ready goes from false to true
    if (!prevProps.ready && ready) {
      const shippingOptions = getShippingOptions(this.props)

      // Initialize shippingMethod
      changeState(SHIPPING_METHOD_ID, {value: R.path([0, 'name'], shippingOptions)})

      // Initialize country
      changeState(SHIPPING_ADDRESS_COUNTRY_FIELD_ID, {value: countryCode, label: R.prop(countryCode, availableCountries)})
      changeState(BILLING_ADDRESS_COUNTRY_FIELD_ID, {value: countryCode, label: R.prop(countryCode, availableCountries)})
    }
  }
  componentDidMount() {
    // Create Stripe Card Element and save on state
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
    changeState(STRIPE_CARD_ID, card)

    // Attach Stripe Card Element
    card.mount('#card-element')
    card.on('change', e => {
      // Get rid of error message on any input change
      changeState(OUTCOME_MESSAGE_ID, {visible: false})

      handleStripeOutcome(e)
    })

    // Initialize states
    const {countryCode} = this.props
    changeState(SHIPPING_ADDRESS_COUNTRY_FIELD_ID, {value: countryCode})
    changeState(BILLING_ADDRESS_COUNTRY_FIELD_ID, {value: countryCode})
    changeState(SAME_SHIPPING_BILLING_CHECKBOX_ID, {value: true})
    changeState(ADDRESS_TOGGLE_ID, {value: 'shipping'})
    changeState(PAYMENT_METHOD_ID, {value: 'cc'})
    changeState(PAYMENT_TERM_FIELD_ID, {value: 0})

    // Prefill fields with given values and set it to valid+touched (i.e. assume all prefill values are valid)
    const {prefill} = this.props
    R.forEach(({stateId, value}) => {
      changeState(stateId, {value, valid: true, touched: true})
    })(prefill)

    // Initialize labels and error messages (for required validator only since by default it'll be empty)
    changeState(EMAIL_FIELD_ID, {label: 'Email', error: 'Please fill out the email'})
    changeState(SHIPPING_ADDRESS_NAME_FIELD_ID, {label: 'Name', error: 'Please fill out the name'})
    changeState(SHIPPING_ADDRESS_LINE1_FIELD_ID, {label: 'Address', error: 'Please fill out the street address'})
    changeState(SHIPPING_ADDRESS_ZIP_FIELD_ID, {error: 'Please fill out the postcode'})
    changeState(SHIPPING_ADDRESS_CITY_FIELD_ID, {error: 'Please fill out the city'})
    changeState(SHIPPING_ADDRESS_COUNTRY_FIELD_ID, {error: 'Please fill out the country'})
    changeState(BILLING_ADDRESS_NAME_FIELD_ID, {label: 'Address', error: 'Please fill out the name'})
    changeState(BILLING_ADDRESS_LINE1_FIELD_ID, {error: 'Please fill out the street address'})
    changeState(BILLING_ADDRESS_ZIP_FIELD_ID, {error: 'Please fill out the postcode'})
    changeState(BILLING_ADDRESS_CITY_FIELD_ID, {error: 'Please fill out the city'})
    changeState(BILLING_ADDRESS_COUNTRY_FIELD_ID, {error: 'Please fill out the country'})
    changeState(PHONE_FIELD_ID, {label: 'Phone', error: 'Please fill out the phone'})
    changeState(SHIPPING_METHOD_ID, {label: 'Shipping'})
    changeState(PAYMENT_TERM_FIELD_ID, {label: 'Pay Term', error: 'Please fill out the payment term'})
  }

  render() {
    const {rootState, locale, userProfile, shippingDetails, countryCode, isPos, btnStyle = {}, btnClassName = ''} = this.props
    const {currency, currencySymbol} = locale
    const isPro = checkIsPro(this.props)
    const isFreeSample = checkIsFreeSample(this.props)
    const countryList = this.getCountryList()
    const shippingCountryCode = this.getValue(SHIPPING_ADDRESS_COUNTRY_FIELD_ID)
    const billingCountryCode = this.getValue(BILLING_ADDRESS_COUNTRY_FIELD_ID)
    const outcomeMessageVisible = R.prop('visible', getElemState(rootState, OUTCOME_MESSAGE_ID))
    const outcomeMessageType = R.prop('type', getElemState(rootState, OUTCOME_MESSAGE_ID))
    const outcomeMessage = R.prop('msg', getElemState(rootState, OUTCOME_MESSAGE_ID))
    const sameShippingBillingChecked = this.getValue(SAME_SHIPPING_BILLING_CHECKBOX_ID)
    const addressToggleState = this.getValue(ADDRESS_TOGGLE_ID)
    const shippingOptions = getShippingOptions(this.props)
    const shippingMethod = this.getValue(SHIPPING_METHOD_ID)
    const paymentMethods = getPaymentMethods()
    const paymentMethod = this.getValue(PAYMENT_METHOD_ID)

    const formData = this.getFormData()
    const total = getTotal(this.props, formData)

    const emailLabel = this.getLabel(EMAIL_FIELD_ID)
    const shippingNameLabel = this.getLabel(SHIPPING_ADDRESS_NAME_FIELD_ID)
    const shippingAddressLine1Label = this.getLabel(SHIPPING_ADDRESS_LINE1_FIELD_ID)
    const billingNameLabel = this.getLabel(BILLING_ADDRESS_NAME_FIELD_ID)
    const billingAddressLine1Label = this.getLabel(BILLING_ADDRESS_LINE1_FIELD_ID)
    const phoneLabel = this.getLabel(PHONE_FIELD_ID)
    const shippingMethodLabel = this.getLabel(SHIPPING_METHOD_ID)
    const paymentTermLabel = this.getLabel(PAYMENT_TERM_FIELD_ID)

    // For cart summary
    const cartItemsWithDetail = getCartItemsWithDetail(this.props)
    const subtotal = getSubtotal(this.props)
    const discount = getDiscount(this.props)
    const subtotalAfterDiscount = subtotal - discount
    const referralCredit = getReferralCredit(this.props, subtotalAfterDiscount)
    const shippingRate = getShippingRate(this.props, shippingMethod)
    const salesTax = getSalesTax(formData, subtotal, shippingRate)

    /**
     * If isPos is true, then:
     *    1) Show payment method
     *    2) Show payment term
     */

    /**
     * If isFreeSample is true (this means it's also isPos is true since web samples
     * are dealt in pro signup flow), then:
     *    1) Hide shipping/billing toggle checkbox (since billing is not required)
     *    2) Hide payment method
     *    3) Hide payment term
     *    4) Hide payment details (cc)
     */

    return (
      <div className="zensa-checkout" style={{textAlign: 'left', justifyContent: 'start'}}>
        {/* page loading */}
        <PageLoading rootState={rootState} />
        {/* end: page loading */}

        {/* outcome notification */}
        <div className={`fixed rounded h5 ${outcomeMessageType === 'error' ? 'bg-soft-red' : 'bg-dark-green'} white center transition-bottom z3 ${outcomeMessageVisible ? 'show-up' : 'hide-down'}`} style={{top: '0.5rem', left: '0.5rem', right: '0.5rem', padding: '0.3rem 0.5rem'}}>
          {outcomeMessage}
        </div>
        {/* end: outcome notification */}

        {/* cart summary */}
        <Collapsible
          trigger="View Cart Summary"
          transitionTime={200}
        >
          <CartSummary
            locale={locale}
            cartItemsWithDetail={cartItemsWithDetail}
            subtotal={subtotal}
            discount={discount}
            referralCredit={referralCredit}
            salesTax={salesTax}
            shippingRate={shippingRate}
            total={total}
          />
        </Collapsible>
        {/* end: cart summary */}

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
                    value={this.getValue(EMAIL_FIELD_ID)}
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
          {/* Hide if isFreeSample or sameShippingBillingChecked */}
          <div className={`${isFreeSample || !sameShippingBillingChecked ? 'display-none' : ''}`} style={{marginBottom: '5px', marginTop: '-8px', fontSize: '0.8rem', color: 'rgba(0,0,0,0.25)'}}>
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
          <div className={`${isFreeSample || sameShippingBillingChecked ? 'display-none' : ''}`}>
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
                        onChange={val => this.handleSelectChange(val.value, val.label, SHIPPING_ADDRESS_COUNTRY_FIELD_ID)}
                      />
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
                        onChange={val => this.handleSelectChange(val.value, val.label, BILLING_ADDRESS_COUNTRY_FIELD_ID)}
                      />
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
              const localPrice = isPro ? getShippingRate(this.props, name) : R.prop(currency, price)
              const displayedPrice = localPrice === 0 ? 'Free' : `${convertToCurrency('', localPrice)}`

              return (
                <div className="label label-lg" key={i}>
                  <div className="row">
                    {i === 0 ? <span className="col-xs-3">{shippingMethodLabel}</span> : <span className="col-xs-3" style={{marginTop: '-1px', backgroundColor: '#fff'}}></span>}
                    <div className="col-xs-9">
                      <div className="flex items-center justify-start" style={{height: '60px'}}>
                        <input
                          type="radio"
                          name="shippingOptions"
                          value={name}
                          checked={this.getValue(SHIPPING_METHOD_ID) === name}
                          onChange={e => this.handleRadioButtonChange(e, SHIPPING_METHOD_ID)}
                          className={`form-field`}
                          style={{width: '24px', marginLeft: '-2px', flexShrink: '0', cursor: 'pointer'}}
                        />
                        <div style={{fontSize: '0.8rem', lineHeight: '1.2rem', color: '#222', fontWeight: '300'}}>
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

          {/* payment method */}
          <div className={`form-group ${isFreeSample || !isPos ? 'display-none' : ''}`}>
            <div className="label">
              <div className="row">
                <span className="col-xs-3">Pay Method</span>
                <div className="col-xs-9">
                  <Select
                    name="payment-method"
                    className="form-field"
                    value={paymentMethod}
                    options={paymentMethods}
                    clearable={false}
                    onChange={val => this.handleSelectChange(val.value, val.label, PAYMENT_METHOD_ID)}
                  />
                  </div>
              </div>
            </div>
          </div>
          {/* end payment method */}

          {/* card + payment term */}
          <div className="form-group">
            <div className={`label ${isFreeSample || !isPos || paymentMethod === 'manual' ? 'display-none' : ''}`}>
              <div className="row">
                <span className="col-xs-3">{paymentTermLabel}</span>
                <div className="col-xs-9">
                  <input
                    id={PAYMENT_TERM_FIELD_ID}
                    value={this.getValue(PAYMENT_TERM_FIELD_ID)}
                    onChange={e => this.handleChange(e, PAYMENT_TERM_FIELD_ID)}
                    onBlur={e => this.handleBlur(e, PAYMENT_TERM_FIELD_ID)}
                    name="payment-term"
                    className={`form-field ${this.getFieldValid(PAYMENT_TERM_FIELD_ID) || !this.getFieldTouched(PAYMENT_TERM_FIELD_ID) ? '' : 'form-field-error'}`}
                    placeholder="0"
                    type="number"
                  />
                </div>
              </div>
            </div>

            {/* Hide card if isFreeSample or paymentMethod is manual */}
            <div className={`label ${isFreeSample || paymentMethod === 'manual' ? 'display-none' : ''}`}>
              <div className="row">
                <span className="col-xs-3">Card</span>
                <span className="col-xs-9"><div id="card-element" className="form-field"></div></span>
              </div>
            </div>
          </div>
          {/* end: card + payment term */}

          <button className={`form-btn mb2 ${btnClassName}`} type="submit" style={btnStyle}>
            Pay {currencySymbol}{convertToCurrency(currencySymbol, total)} <span className="h5">({R.compose(R.toUpper, R.last, R.split('-'), R.prop('locale'))(locale)}D)</span>
          </button>
        </form>
      </div>
    )
  }
}
