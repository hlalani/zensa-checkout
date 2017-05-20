import test from 'tape'
import {
  mergeLineItems,
} from './core'

test('mergeLineItems()', assert => {
  const productDetails = [
    {
      sku: '627843518188',
      lineItems: [
        {
          quantity: 1,
          sku: '627843518167'
        },
        {
          quantity: 1,
          sku: '627843518230'
        },
        {
          quantity: 2,
          sku: '627843518202'
        },
        {
          quantity: 2,
          sku: '627843518244'
        }
      ]
    },
    {
      sku: '627843518195',
      lineItems: [
        {
          quantity: 1,
          sku: '627843518167'
        },
        {
          quantity: 2,
          sku: '627843518223'
        },
        {
          quantity: 2,
          sku: '627843518202'
        },
        {
          quantity: 2,
          sku: '627843518244'
        },
        {
          quantity: 4,
          sku: '627843518251'
        }
      ]
    },
    {
      sku: '627843518209',
      lineItems: [
        {
          quantity: 1,
          sku: 627843518167
        },
        {
          quantity: 1,
          sku: 627843518230
        },
        {
          quantity: 2,
          sku: 627843518202
        },
        {
          quantity: 1,
          sku: 627843518244
        }
      ]
    },
    {
      sku: '627843518174'
    },
    {
      sku: '627843518167'
    },
    {
      sku: '627843518216',
      lineItems: [
        {
          quantity: 20,
          sku: '627843518202'
        }
      ]
    }
  ]
  const cartItemState = {
    627843518188: 2,
    627843518195: 3,
    627843518216: 1,
    627843518167: 1,
  }
  const actual = mergeLineItems(productDetails, cartItemState)
  const expected = [
    {sku: '627843518167', quantity: 6},
    {sku: '627843518230', quantity: 2},
    {sku: '627843518202', quantity: 30},
    {sku: '627843518244', quantity: 10},
    {sku: '627843518223', quantity: 6},
    {sku: '627843518251', quantity: 12},
  ]

  assert.deepEqual(actual, expected,
    `Given productDetails and cartItemState, mergeLineItems() should return
    all unique lineItems merged together`)

  assert.end()
})
