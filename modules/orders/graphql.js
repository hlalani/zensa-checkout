import axios from 'axios'
import config from '../../client-config'

export const saveOrder = orderObj => {
  const query = `
    mutation SaveOrder($input: OrderInput!) {
      saveOrder(input: $input) {
        name
        businessName
        email
        phone
        cartItems {
          sku
          quantity
        }
        lineItems {
          sku
          quantity
        }
        shipping {
          address_line1
          address_zip
          address_city
          address_state
          address_country
        }
        shipped
      }
    }
  `
  return axios.post(`${config.apiBase}/graphql`, {
    query,
    variables: {
      input: orderObj
    }
  })
}

// from and to in milliseconds based on UTC
export const getOrders = (from, to) => {
  const query = `
    query GetOrders($from: String!, $to: String!) {
      getOrders(from: $from, to: $to) {
        created
        name
        businessName
        email
        phone
        cartItems {
          sku
          quantity
        }
        lineItems {
          sku
          quantity
        }
        shipping {
          address_line1
          address_zip
          address_city
          address_state
          address_country
        }
        shipped
      }
    }
  `
  return axios.post(`${config.apiBase}/graphql`, {
    query,
    variables: {
      from: from.toString(), // convert to string since graphql cannot handle large integers
      to: to.toString(),
    }
  })
}
