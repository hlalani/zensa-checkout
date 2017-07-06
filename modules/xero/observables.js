import config from '../../client-config'
import axios from 'axios'
import Rx from 'rx-lite'

export const getXeroContacts$ = Rx.Observable.create(observer => {
  axios.get(`${config.apiBase}/api/xero/contacts`)
    .then(res => {
      observer.onNext(res.data)
      observer.onCompleted()
    })
    .catch(err => observer.onError(err))
})

export const getXeroContact$$ = (contactId) => {
  return Rx.Observable.create(observer => {
    axios.get(`${config.apiBase}/api/xero/contacts/${contactId}`)
      .then(res => {
        observer.onNext(res.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const getXeroContactByEmail$$ = (email) => {
  const encodedEmail = encodeURIComponent(email)
  return Rx.Observable.create(observer => {
    axios.get(`${config.apiBase}/api/xero/contacts?email=${encodedEmail}`)
      .then(res => {
        observer.onNext(res.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

/*
  contact = {
    Name: 'Johnnies Coffee',
    FirstName: 'John',
    LastName: 'Smith',
  }
*/
export const createXeroContact$$ = (contact) => {
  return Rx.Observable.create(observer => {
    axios.post(`${config.apiBase}/api/xero/contacts`, contact)
      .then(res => {
        observer.onNext(res.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const updateXeroContact$$ = (contactId, updateContact) => {
  return Rx.Observable.create(observer => {
    axios.put(`${config.apiBase}/api/xero/contacts/${contactId}`, updateContact)
      .then(res => {
        observer.onNext(res.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const createOrUpdateXeroContact$$ = (contact) => {
  const {EmailAddress: email} = contact
  return getXeroContactByEmail$$(email)
    .flatMap((contactRes) => {
      if (R.isNil(contactRes)) {
        // This means the contact is not found
        return createXeroContact$$(contact)
      } else {
        // Contact already exists
        const {ContactId: contactId} = contactRes
        return updateXeroContact$$(contactId, contact)
      }
    })
}

/*
  invoice = {
    Type: 'ACCREC',
    Status: 'AUTHORISED', // or 'PAID'
    Contact: {
      Name: xeroName,
    },
    DueDate: new Date().toISOString().split("T")[0],
    LineItems: xeroLineItems,
  }
*/
export const createXeroInvoice$$ = (invoice) => {
  return Rx.Observable.create(observer => {
    axios.post(`${config.apiBase}/api/xero/invoices`, invoice)
      .then(res => {
        observer.onNext(res.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const updateXeroInvoice$$ = (invoiceId, updateInvoice) => {
  return Rx.Observable.create(observer => {
    axios.put(`${config.apiBase}/api/xero/invoices/${invoiceId}`, updateInvoice)
      .then(res => {
        observer.onNext(res.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

/*
  payment = {
    Invoice: {
      InvoiceID: 'cac488a2-e40c-42b2-b8c4-b4a0d2e75bb4'
    },
    Account: {
      Code: '200'
    },
    Date: new Date().toISOString().split("T")[0],
    Amount: '1000.00'
  }
*/
export const createXeroPayment$$ = (payment) => {
  return Rx.Observable.create(observer => {
    axios.post(`${config.apiBase}/api/xero/payments`, payment)
      .then(res => {
        observer.onNext(res.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}
