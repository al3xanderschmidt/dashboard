//
// Copyright (c) 2018 by SAP SE or an SAP affiliate company. All rights reserved. This file is licensed under the Apache Software License, v. 2 except as noted otherwise in the LICENSE file
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

'use strict'

const _ = require('lodash')
const crypto = require('crypto')
const config = require('../../config')
const { InternalServerError, Forbidden } = require('../../errors')

const verifySignature = function (req, res, next) {
  const webhookSecret = _.get(config, 'gitHub.webhookSecret')
  if (!webhookSecret) {
    next(new InternalServerError('gitHub.webhookSecret not configured on dashboard backend'))
  }
  const requestSignature = _.get(req.headers, 'x-hub-signature')
  if (!requestSignature) {
    next(new Forbidden('x-hub-signature header not provided'))
  }

  const hmac = crypto.createHmac('sha1', webhookSecret.toString())
  if (req.body) {
    const payloadBody = req.body
    hmac.update(payloadBody)
  }

  const signature = 'sha1=' + hmac.digest('hex')

  const equal = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(requestSignature))
  if (!equal) {
    next(new Forbidden('Signatures didn\'t match!'))
  } else {
    next()
  }
}
exports.verifySignature = verifySignature
