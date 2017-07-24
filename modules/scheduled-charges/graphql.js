import axios from 'axios'
import config from '../../client-config'

export const createScheduledCharge = (scheduledChargeObj) => {
  const query = `
    mutation CreateScheduledCharge($input: ScheduledChargeInput!) {
      createScheduledCharge(input: $input) {
        email
        customerId
        chargeOn
        chargeAttempted
        charged
        created
        invoiceId
        amount
        currency
        currencyRate
      }
    }
  `
  return axios.post(`${config.apiBase}/graphql`, {
    query,
    variables: {
      input: scheduledChargeObj,
    }
  })
}

export const updateScheduledCharge = (email, scheduledChargeObj) => {
  const query = `
    mutation UpdateScheduledCharge($email: String, $input: ScheduledChargeInput!) {
      updateScheduledCharge(email: $email, input: $input) {
        email
        customerId
        chargeOn
        chargeAttempted
        charged
        created
        invoiceId
        amount
        currency
        currencyRate
      }
    }
  `
  return axios.post(`${config.apiBase}/graphql`, {
    query,
    variables: {
      email,
      input: scheduledChargeObj,
    }
  })
}

export const getScheduledCharges = () => {
  const query = `
    query {
      email
      customerId
      chargeOn
      chargeAttempted
      charged
      created
      invoiceId
      amount
      currency
      currencyRate
    }
  `
  return axios.post(`${config.apiBase}/graphql`, {
    query,
  })
}
