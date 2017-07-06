import React, {Component} from 'react'
import PropTypes from 'prop-types'
import R from 'ramda'
import {convertToCurrency} from '../../modules/global/core'

export default class CartSummary extends Component {
  static propTypes = {
    locale: PropTypes.object.isRequired,
    cartItemsWithDetail: PropTypes.array.isRequired,
    subtotal: PropTypes.number.isRequired,
    discount: PropTypes.number.isRequired,
    referralCredit: PropTypes.number.isRequired,
    salesTax: PropTypes.number.isRequired,
    shippingRate: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
  }

  constructor(props) {
    super(props)
  }

  render() {
    const {
      locale,
      cartItemsWithDetail,
      subtotal,
      discount,
      referralCredit,
      salesTax,
      shippingRate,
      total,
    } = this.props
    const {currencySymbol} = locale
    const discountRate = subtotal === 0 ? 0 : Math.round(discount / subtotal * 100)
    const AccountLine = ({text, number, subtext, style, numberStyle}) => (
      <div className="flex items-center justify-between px1 mb1" style={style}>
        <div>
          <div>{text}</div>
          <div className="gray italic h6" style={{display: R.isNil(subtext) ? 'none' : 'block'}}>{subtext}</div>
        </div>
        <div className="normal" style={numberStyle}>{convertToCurrency(currencySymbol, number)}</div>
      </div>
    )

    return (
      <div className="my2 p2 border h5 metal-gray light" style={{borderColor: 'rgba(256,256,256,0.4)', backgroundColor: 'rgba(256,256,256,0.35)', borderRadius: '5px'}}>
        {/* cart items */}
        {cartItemsWithDetail.map((cartItem, i) => {
          const {sku, name, quantity, price, thumbUrl} = cartItem
          return (
            <div className="mb1 mr1" key={i}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="relative" style={{marginTop: '8px', marginLeft: '8px'}}>
                    <div className="absolute bg-gray white flex items-center justify-center h6" style={{padding: '0px 4px', borderRadius: '50px', minWidth: '12px', height: '20px', top: '-8px', left: '-8px'}}>
                      {quantity}
                    </div>
                    <img src={thumbUrl} className="border border-silver" style={{width: '60px', borderRadius: '4px'}} />
                  </div>
                  <div className="ml1">{name}</div>
                </div>
                <div className="normal">{convertToCurrency(currencySymbol, price)}/ea</div>
              </div>
            </div>
          )
        })}
        {/* end: cart items */}

        {/* numbers */}
        <div className="border-top pt1" style={{borderColor: 'rgb(222, 229, 236)'}}>
          <AccountLine text={'Subtotal'} number={subtotal} />
          <AccountLine text={`Discount (${discountRate}%)`} number={discount} />
          <AccountLine text={'Referral Credit'} number={referralCredit} />
          <AccountLine text={'Shipping'} number={shippingRate} />
        </div>

        <div className="border-top pt1" style={{borderColor: 'rgb(222, 229, 236)'}}>
          <AccountLine text={'Sales Tax*'} number={shippingRate} subtext={'*Will update based on your shipping address'}/>
        </div>

        <div className="border-top pt1" style={{borderColor: 'rgb(222, 229, 236)'}}>
          <AccountLine text={'Total'} number={total} style={{marginBottom: '0px', fontWeight: '500'}} numberStyle={{fontWeight: '500'}}/>
        </div>
        {/* end: numbers */}
      </div>
    )
  }
}
