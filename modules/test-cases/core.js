import R from 'ramda'
import {
  MICROBLADING_PACK_SKU,
  NUMBING_CREAM_30G_SKU,
  SAMPLE_PACK_SKU,
} from '../global/constants'

const cartItems = {
  [MICROBLADING_PACK_SKU]: 2,
}
const proCartItems = {
  [NUMBING_CREAM_30G_SKU]: 4,
}
const sampleCartItems = {
  [SAMPLE_PACK_SKU]: 1,
}
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
const userProfileWithReferralCredit = {
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
      "credit": 1000,
    },
    "story": "Test"
  },
  "referralCode": "SLEE",
  "referred_by": "",
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
    stateId: 'zcoShippingAddressStateField',
    value: 'BC',
  },
  {
    stateId: 'zcoPhoneField',
    value: '123-456-7890',
  },
]
const internationalPrefill = [
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
    value: '425 - 2441 76TH AVE SE',
  },
  {
    stateId: 'zcoShippingAddressZipField',
    value: '98040',
  },
  {
    stateId: 'zcoShippingAddressCityField',
    value: 'Mercer Island',
  },
  {
    stateId: 'zcoShippingAddressStateField',
    value: 'WA',
  },
  {
    stateId: 'zcoPhoneField',
    value: '123-456-7890',
  },
  {
    stateId: 'zcoPhoneField',
    value: '123-456-7890',
  },
]
const customer = {
  "id": "cus_ALkbYOcxlT1Vbv",
  "object": "customer",
  "account_balance": 0,
  "created": 1490403017,
  "currency": null,
  "default_source": "card_1AiCO7DmrMVpIExo5p7kEi6Z",
  "delinquent": false,
  "description": "seunggs@gmail.com",
  "discount": null,
  "email": "seunggs@gmail.com",
  "livemode": false,
  "metadata": {
    "city": "Vancouver",
    "country": "CA",
    "line1": "1415 - 938 Smithe St",
    "postal_code": "V6Z3H8",
    "state": "BC",
    "name": "Seungchan Lee",
    "business_name": "N/A",
    "phone": "123-456-7890",
    "couponId": "None",
    "shipping_method": "UPS Ground",
    "shipping_price": "0",
    "products": "2 of Zensa Microblading Kit",
    "quantity": "2",
    "professional_free_sample": "false",
    "new": "false"
  },
  "shipping": {
    "address": {
      "city": "Vancouver",
      "country": "CA",
      "line1": "1415 - 938 Smithe St",
      "line2": null,
      "postal_code": "V6Z3H8",
      "state": "BC"
    },
    "name": "Seungchan Lee",
    "phone": "123-456-7890"
  },
  "sources": {
    "object": "list",
    "data": [{
      "id": "card_1AiCO7DmrMVpIExo5p7kEi6Z",
      "object": "card",
      "address_city": "Vancouver",
      "address_country": "CA",
      "address_line1": "1415 - 938 Smithe St",
      "address_line1_check": "pass",
      "address_line2": null,
      "address_state": null,
      "address_zip": "V6Z3H8",
      "address_zip_check": "pass",
      "brand": "Visa",
      "country": "US",
      "customer": "cus_ALkbYOcxlT1Vbv",
      "cvc_check": "pass",
      "dynamic_last4": null,
      "exp_month": 4,
      "exp_year": 2024,
      "fingerprint": "Hga9jUcaqGQmdPyS",
      "funding": "credit",
      "last4": "4242",
      "metadata": {},
      "name": "Seungchan Lee",
      "tokenization_method": null
    }],
    "has_more": false,
    "total_count": 1,
    "url": "/v1/customers/cus_ALkbYOcxlT1Vbv/sources"
  },
  "subscriptions": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/customers/cus_ALkbYOcxlT1Vbv/subscriptions"
  }
}

export const getTestCase = (key) => {
  const testCases = {
    retail: {
      prefill,
      userProfile: null,
      customer: null,
      cartItems,
      isPos: false,
      coupon: {},
      updateBilling: false,
    },
    retailWithCoupon: {
      prefill,
      userProfile: null,
      customer: null,
      cartItems,
      isPos: false,
      coupon: {
        applyTo: 'first',
        couponId: 'LOLO20',
        discount: 20,
        oneTimeUse: false,
        professionalSample: false,
        type: 'percent',
        validUntil: 32503680000000,
      },
      updateBilling: false,
    },
    pro: {
      prefill,
      userProfile,
      customer: null,
      cartItems: proCartItems,
      isPos: false,
      coupon: {},
      updateBilling: false,
    },
    proWithCoupon: {
      prefill,
      userProfile,
      customer: null,
      cartItems: proCartItems,
      isPos: false,
      coupon: {
        applyTo: 'first',
        couponId: 'LOLO20',
        discount: 20,
        oneTimeUse: false,
        professionalSample: false,
        type: 'percent',
        validUntil: 32503680000000,
      },
      updateBilling: false,
    },
    proWithReferral: {
      prefill,
      userProfile: userProfileWithReferralCredit,
      customer: null,
      cartItems: proCartItems,
      isPos: false,
      coupon: {},
      updateBilling: false,
    },
    proExisting: {
      prefill: [],
      userProfile,
      customer,
      cartItems: proCartItems,
      isPos: false,
      coupon: {},
      updateBilling: false,
    },
    proInternational: {
      prefill: internationalPrefill,
      userProfile,
      customer: null,
      cartItems: proCartItems,
      isPos: false,
      coupon: {},
      updateBilling: false,
    },
    posPro: {
      prefill,
      userProfile,
      customer: null,
      cartItems: proCartItems,
      isPos: true,
      coupon: {},
      updateBilling: false,
    },
    posProExisting: {
      prefill: [],
      userProfile,
      customer,
      cartItems: proCartItems,
      isPos: true,
      coupon: {},
      updateBilling: false,
    },
    posProManualPayment: {
      prefill,
      userProfile,
      customer: null,
      cartItems: proCartItems,
      isPos: true,
      coupon: {},
      updateBilling: false,
    },
    posProManualShipping: {
      prefill,
      userProfile,
      customer: null,
      cartItems: proCartItems,
      isPos: true,
      coupon: {},
      updateBilling: false,
    },
    posProNet30: {
      prefill,
      userProfile,
      customer: null,
      cartItems: proCartItems,
      isPos: true,
      coupon: {},
      updateBilling: false,
    },
    posSample: {
      prefill,
      userProfile,
      customer: null,
      cartItems: sampleCartItems,
      isPos: true,
      coupon: {},
      updateBilling: false,
    },
    updateBilling: {
      prefill,
      userProfile,
      customer,
      cartItems,
      isPos: false,
      coupon: {},
      updateBilling: true,
    },
  }
  return testCases[key]
}

export const getTestCaseExpected = (testCaseKey) => {
  const testCaseExpected = {
    retail: {
      'instructions': [
        'Fill out the payment info and press the Pay button',
      ],
      'ui': [
        'Should NOT see manual shipping option',
        'Should NOT see payment method option',
        'Should NOT see payment term option',
        'Should see the UPS Ground option as free',
        'Clicking on View Cart Summary should expand cart info',
        'With more than 1 item in the cart, Cart Summary should show 10% discount',
        'Changing shipping method should update total in Cart Summary and button text',
        'Leaving any field empty should return an error',
        'Incorrect email address should return an error',
        'Should see sales tax below the button and the total amount in the button should include sales tax',
      ],
      'success': [
        'Create/update Stripe customer',
        'Charge',
        'Added email to MailChimp',
        'Send order email',
        'Save order details to DB',
        'Create shipping labels',
        'Create customer in Xero, create invoice, and add payment to mark the invoice paid',
        'Display success notification',
        'Redirect to thank you page (skip for testing purposes)',
        'Different shipping and billing info should still show success',
      ],
      'error': [
        'Wrong credit card info should return proper error message',
        'Declined credit card should return proper error message',
      ],
    },
    retailWithCoupon: {
      'instructions': [
        'Fill out the payment info and press the Pay button',
      ],
      'ui': [
        'Should see total of 20% discount in Cart Summary (20% off for the first quantity + 10% retail volume discount of total amount)',
      ],
      'success': [
        'Same as retail but:',
        'Order email should should couponId of LOLO20',
      ],
      'error': [
        'No need to test',
      ],
    },
    pro: {
      'instructions': [
        'Fill out the payment info and press the Pay button',
      ],
      'ui': [
        'Should see 42% discount in Cart Summary',
        'Should see UPS Ground shipping that\'s not free',
        'Pay button currency should show CAD',
      ],
      'success': [
        'Create/update Stripe customer',
        'Charge',
        'Added email to MailChimp',
        'Send order email',
        'Save order details to DB',
        'Create shipping labels',
        'Create customer in Xero, create invoice, and add payment to mark the invoice paid',
        'Display success notification',
        'Redirect to thank you page (skip for testing purposes)',
        'Different shipping and billing info should still show success',
      ],
      'error': [
        'Wrong credit card info should return proper error message',
        'Declined credit card should return proper error message',
      ],
    },
    proWithCoupon: {
      'instructions': [
        'Fill out the payment info and press the Pay button',
      ],
      'ui': [
        'Should see 47% discount in Cart Summary (wholesale discount + 20% extra off the first quantity)',
      ],
      'success': [
        'Same as pro but:',
        'Order email should should couponId of LOLO20',
      ],
      'error': [
        'No need to test',
      ],
    },
    proWithReferral: {
      'instructions': [
        'Fill out the payment info and press the Pay button',
      ],
      'ui': [
        'Referral Credit of $10 should show in Cart Summary',
      ],
      'success': [
        'Same as pro but with:',
        'Referral credit resetted to 0 in DB',
      ],
      'error': [
        'No need to test',
      ],
    },
    proExisting: {
      'instructions': [
        'Fill out the payment info and press the Pay button',
      ],
      'ui': [
        'Should see all the fields filled out (except credit card info of course)',
        'Should show shipping and billing toggle buttons by default',
      ],
      'success': [
        'Same as pro except skipping Stripe customer creation',
      ],
      'error': [
        'No need to test',
      ],
    },
    proInternational: {
      'instructions': [
        'Fill out the payment info and press the Pay button',
      ],
      'ui': [
        'Fields should be filled with US address',
        'Pay button currency should show USD',
        'Should show US wholesale discount rate of 39%',
        'Should show US shipping rates',
        'Should NOT show sales tax below the button (since sales tax should be 0 in this case)',
      ],
      'success': [
        'Stripe charge should be in USD',
        'Xero invoice should show USD in currency',
        'Shipment should include customsDeclaration obj and label should be created properly',
      ],
      'error': [
        'No need to test',
      ],
    },
    posPro: {
      'instructions': [
        'Fill out the payment info and press the Pay button',
      ],
      'ui': [
        'Should show manual delivery option',
        'Should show payment method field, defaulted to Credit Card',
        'Should show payment term, defaulted to 0',
      ],
      'success': [
        'Create/update Stripe customer',
        'Charge',
        'Send order email',
        'Save order details to DB',
        'Create shipping labels',
        'Create customer in Xero, create invoice, and add payment to mark the invoice paid',
        'Display success notification',
        'Different shipping and billing info should still show success',
        'Do NOT track in MixPanel or add to MailChimp list',
      ],
      'error': [
        'Wrong credit card info should return proper error message',
        'Declined credit card should return proper error message',
      ],
    },
    posProExisting: {
      'instructions': [
        'Fill out the payment info and press the Pay button',
      ],
      'ui': [
        'Should see all the fields filled out (except credit card info of course)',
        'Should show shipping and billing toggle buttons by default',
      ],
      'success': [
        'Same as POS Pro except skipping Stripe customer creation',
      ],
      'error': [
        'No need to test',
      ],
    },
    posProManualPayment: {
      'instructions': [
        'Change the Payment Method field to Manual (default is Credit Card)',
        'Check the UI change',
        'Fill out the payment info and press the Pay button',
      ],
      'ui': [
        'Upon changing Payment Method to manual, Pay Term and Card fields should disappear',
        'Changing Payment Method back to Credit Card should show Pay Term and Card fields',
      ],
      'success': [
        'Send order email to fulfillment',
        'Save order details to DB',
        'Create shipping labels',
        'Create customer in Xero, create invoice, but do NOT add payment',
        'Display success notification',
        'Do NOT track in MixPanel or add to MailChimp list',
      ],
      'error': [
        'No need to test',
      ],
    },
    posProManualShipping: {
      'instructions': [
        'Pick Manual Delivery option for shipping',
        'Fill out the payment info and press the Pay button',
      ],
      'ui': [
        'Same as POS Pro',
      ],
      'success': [
        'Everything else is the same as POS Pro, but should not create shipping label',
      ],
      'error': [
        'No need to test',
      ],
    },
    posProNet30: {
      'instructions': [
        'Set Pay Term to 30',
        'Fill out the payment info and press the Pay button',
      ],
      'ui': [
        'Same as POS Pro',
      ],
      'success': [
        'Send order email to fulfillment',
        'Save order details to DB',
        'Create shipping labels',
        'Create customer in Xero, create invoice with correct due date (30 days from today), but do NOT add payment',
        'Create scheduledCharge obj in DB with proper values',
        'Run the test script to make sure the bot.js charges properly: npm run testScheduledCharges - if yes, it will output output "ALL GOOD!!!"',
        'Display success notification',
        'Do NOT track in MixPanel or add to MailChimp list',
      ],
      'error': [
        'Declined credit card should return proper error message and should not create scheduledCharge obj in DB',
      ],
    },
    posSample: {
      'instructions': [
        'Just press the Pay button',
      ],
      'ui': [
        'Should see Zensa Free Sample Pack of quantity 1 in the Cart Summary',
        'Should NOT show shipping/billing toggle checkbox (since billing is not required)',
        'Should NOT show payment method',
        'Should NOT show payment term',
        'Should NOT show payment details (cc)',
      ],
      'success': [
        'Send order email ([ORDER - FREE SAMPLE FROM POS]) to fulfillment',
        'Save order details to DB',
        'Create shipping labels',
        'Create a Xero contact, create an invoice for 5 cents and add payment to mark the invoice paid',
        'Display success notification',
        'Do NOT track in MixPanel or add to MailChimp list',
      ],
      'error': [
        'No need to test',
      ],
    },
    updateBilling: {
      'instructions': [
        'Try changing the shipping address street',
        'Try changing the billing address street',
      ],
      'ui': [
        'Should NOT see Cart Summary',
        'Button text should show Update Billing Info',
        'Should show shipping and billing toggle buttons by default',
        'Should NOT show shipping options',
        'Should NOT show payment method',
        'Should NOT show payment term',
        'Clicking on Billing toggle button should show all fields filled out',
      ],
      'success': [
        'Update Stripe customer information - check in Stripe to see if the info has changed',
        'Should not charge or do anything else other than update Stripe customer info',
      ],
      'error': [
        'No need to test',
      ],
    },
  }
  return testCaseExpected[testCaseKey]
}
