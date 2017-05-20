let __ENV__
if (typeof(__NODE_ENV__) !== 'undefined') {
  if (__NODE_ENV__ === 'production' && process.env.HEROKU_APP_NAME === 'zensa') {
    __ENV__ = 'production'
  } else if (__NODE_ENV__ === 'production' && process.env.HEROKU_APP_NAME === 'zensa-staging') {
    __ENV__ = 'production'
  }
} else {
  __ENV__ = 'development'
}
console.log('HEROKU_APP_NAME: ', process.env.HEROKU_APP_NAME)
console.log('Current ENV: ', __ENV__)
export {__ENV__}

export const SUPPORT_EMAIL = __ENV__ === 'production' ? 'info@zensaskincare.com' : 'seungchan@zensaskincare.com'
export const ORDER_EMAILS = __ENV__ === 'production' ? ['slai@aleraskin.com', 'hlalani@aleraskin.com', 'seungchan@zensaskincare.com'] : ['seungchan@zensaskincare.com']
export const PROFESSIONAL_SIGNUP_NOTIFICATION_EMAILS = __ENV__ === 'production' ? ['slai@aleraskin.com', 'hlalani@aleraskin.com', 'seungchan@zensaskincare.com'] : ['seungchan@zensaskincare.com']
export const PROFESSIONAL_ADD_BILLING_NOTIFICATION_EMAILS = __ENV__ === 'production' ? ['hlalani@aleraskin.com', 'seungchan@zensaskincare.com'] : ['seungchan@zensaskincare.com']
export const SUPPORT_PHONE = '1-844-441-SKIN(7546)'
export const SUPPORT_ADDRESS_1 = '110 - 4268 Lozells Ave'
export const SUPPORT_ADDRESS_2 = 'Burnaby, BC'
export const MAILCHIMP_USERNAME = 'zensaskincare'
export const MAILCHIMP_API_BASE = 'https://us13.api.mailchimp.com'
export const MAILCHIMP_LOYALTY_LIST_ID = '419043e97d'
export const MAILCHIMP_PROFESSIONAL_LIST_ID = '5c632b49fb'
export const MAILCHIMP_PROFESSIONAL_FREE_SAMPLE_LIST_ID = 'f16b6543a9'
export const MAILCHIMP_PROFESSIONAL_BUYER_LIST_ID = '90e5a8902c'

// shipping
export const FREE_SHIPPING_AVAILABLE_COUNTRIES = ['CA', 'US']
export const FREE_OVERNIGHT_AVAILABLE_COUNTRIES = ['CA', 'US']
export const NON_INTERNATIONAL_COUNTRIES = ['CA', 'US']

// products
export const NUMBING_CREAM_30G_SKU = '627843518167'
export const HEALING_CREAM_237ML_SKU = '627843518174'
export const HEALING_CREAM_60ML_SKU = '627843518181'
export const TATTOO_PACK_SKU = '627843518188'
export const MICROBLADING_PACK_SKU = '627843518195'
export const HEALING_CREAM_5ML_SKU = '627843518202'
export const SAMPLE_PACK_SKU = '627843518209'
export const HEALING_CREAM_5ML_20PACK_SKU = '627843518216'
export const TEGADERM_SM_SKU = '627843518223'
export const TEGADERM_MD_SKU = '627843518230'
export const TEGADERM_LG_SKU = '627843518237'
export const ALCOHOL_SWAB_SKU = '627843518244'
export const MICROBRUSH_SKU = '627843518251'

// volume discount
export const RETAIL_VOLUME_DISCOUNT_TABLE = {
  1: 0,
  2: 10,
  3: 10,
}

// referral
export const REFERRED_CREDIT_RATE = 10 // 10 percent discount off initial purchase if you are referred by someone
export const REFERRAL_CREDIT_RATE = 10 // 10 percent discount off any purchase if you refer someone
