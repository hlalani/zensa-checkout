import R from 'ramda'

// convertToCurrency :: String -> Float -> String
export const convertToCurrency = R.curry((currencySymbol, num) => {
  // return currencySymbol + (num / 100).toFixed(2)
  return !R.isNil(num) ? (num / 100).toFixed(2) : ''
})
