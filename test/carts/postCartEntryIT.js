/*******************************************************************************
 *
 *    Copyright 2018 Adobe. All rights reserved.
 *    This file is licensed to you under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License. You may obtain a copy
 *    of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software distributed under
 *    the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 *    OF ANY KIND, either express or implied. See the License for the specific language
 *    governing permissions and limitations under the License.
 *
 ******************************************************************************/

'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const HttpStatus = require('http-status-codes');
const setup = require('../lib/setupIT.js').setup;
const extractToken = require('../lib/setupIT').extractToken;
const CcifIdentifier = require('../../src/common/CcifIdentifier');
const expect = chai.expect;
const requiredFields = require('../lib/requiredFields');
const OAUTH_TOKEN_NAME = require('../../src/common/constants').OAUTH_TOKEN_NAME;
chai.use(chaiHttp);


describe('commercetools postCartEntry', function() {

    describe('Integration tests', function() {

        // Get environment
        let env = setup();

        // Increase test timeout
        this.slow(env.slow);
        this.timeout(env.timeout);

        let cartId;
        let accessToken;

        const productVariantId = '90ed1673-4553-47c6-9336-5cb23947abb2-1';
        const productVariantIdSecond = '90ed1673-4553-47c6-9336-5cb23947abb2-2';

        /** Create cart. */
        beforeEach(function() {
            return chai.request(env.openwhiskEndpoint)
                .post(env.cartsPackage + 'postCart')
                .query({
                    currency: 'USD',
                    quantity: 3,
                    productVariantId: productVariantId
                })
                .set('Accept-Language', 'en-US')
                .then(function (res) {
                    expect(res).to.be.json;
                    expect(res).to.have.status(HttpStatus.CREATED);
                    expect(res.body.id).to.not.be.empty;

                    // Store cart id
                    cartId = res.body.id;
                    // Store token to access the anonymous session
                    accessToken = extractToken(res);
                });
        });

        it('creates an empty cart', function() {
            return chai.request(env.openwhiskEndpoint)
                .post(env.cartsPackage + 'postCartEntry')
                .query({
                    currency: 'EUR'
                })
                .set('Accept-Language', 'en-US')
                .set('cookie', `${OAUTH_TOKEN_NAME}=${accessToken};`)
                .then(function (res) {
                    expect(res).to.be.json;
                    expect(res).to.have.status(HttpStatus.CREATED);
                    expect(res).to.have.property('headers');
                    expect(res.headers).to.have.property('location');

                    // Verify structure
                    requiredFields.verifyCart(res.body);
                    expect(res.body.id).to.not.be.empty;
                    expect(res.body).to.have.own.property('lastModifiedAt');
                    expect(res.body).to.have.own.property('createdAt');
                    expect(res.body.entries).to.have.lengthOf(0);
                });
        });

        it('adds a product to an existing cart', function() {
            return chai.request(env.openwhiskEndpoint)
                .post(env.cartsPackage + 'postCartEntry')
                .query({
                    quantity: 2,
                    id: cartId,
                    productVariantId: productVariantIdSecond
                })
                .set('Accept-Language', 'en-US')
                .set('cookie', `${OAUTH_TOKEN_NAME}=${accessToken};`)
                .then(function (res) {
                    expect(res).to.be.json;
                    expect(res).to.have.status(HttpStatus.CREATED);
                    expect(res).to.have.property('headers');
                    expect(res.headers).to.have.property('location');

                    // Verify structure
                    requiredFields.verifyCart(res.body);
                    let ccifResId = new CcifIdentifier(res.body.id);
                    let ccifParamId = new CcifIdentifier(cartId);
                    expect(ccifResId.getCommerceToolsId()).to.equal(ccifParamId.getCommerceToolsId());
                    expect(ccifResId.getCommerceToolsVersion()).not.to.equal(ccifParamId.getCommerceToolsVersion());
                    expect(res.body).to.have.own.property('lastModifiedAt');
                    expect(res.body).to.have.own.property('createdAt');
                    expect(res.body.entries).to.have.lengthOf(2);

                    // Verify that product was added
                    let addedEntry;
                    for(let entry of res.body.entries) {
                        if(entry.productVariant.id == productVariantIdSecond) {
                            addedEntry = entry;
                        }
                    }
                    expect(addedEntry.quantity).to.equal(2);
                });
        });

        it('adds a product to a new cart', function() {
            return chai.request(env.openwhiskEndpoint)
                .post(env.cartsPackage + 'postCartEntry')
                .query({
                    currency: 'USD',
                    quantity: 2,
                    productVariantId: productVariantId
                })
                .set('Accept-Language', 'en-US')
                .set('cookie', `${OAUTH_TOKEN_NAME}=${accessToken};`)
                .then(function (res) {
                    expect(res).to.be.json;
                    expect(res).to.have.status(HttpStatus.CREATED);
                    expect(res).to.have.property('headers');
                    expect(res.headers).to.have.property('location');

                    // Verify structure
                    requiredFields.verifyCart(res.body);
                    expect(res.body.id).to.not.be.empty;
                    expect(res.body).to.have.own.property('lastModifiedAt');
                    expect(res.body).to.have.own.property('createdAt');
                    expect(res.body.entries).to.have.lengthOf(1);

                    // Verify entry structure
                    const entry = res.body.entries[0];
                    expect(entry.quantity).to.equal(2);
                    expect(entry.productVariant.id).to.equal(productVariantId);
                });
        });

        it('returns a 400 error for an invalid currency', function() {
            return chai.request(env.openwhiskEndpoint)
                .post(env.cartsPackage + 'postCartEntry')
                .query({
                    currency: 'EURO'
                })
                .set('Accept-Language', 'en-US')
                .set('cookie', `${OAUTH_TOKEN_NAME}=${accessToken};`)
                .then(function(res) {
                    expect(res).to.have.status(HttpStatus.BAD_REQUEST);
                    expect(res).to.be.json;
                    requiredFields.verifyErrorResponse(res.body);
                });
        });

        it('returns a 400 error for an invalid quantity', function() {
            return chai.request(env.openwhiskEndpoint)
                .post(env.cartsPackage + 'postCartEntry')
                .query({
                    quantity: -12,
                    id: cartId,
                    productVariantId: productVariantIdSecond
                })
                .set('Accept-Language', 'en-US')
                .set('cookie', `${OAUTH_TOKEN_NAME}=${accessToken};`)
                .then(function(res) {
                    expect(res).to.have.status(HttpStatus.BAD_REQUEST);
                    expect(res).to.be.json;
                    requiredFields.verifyErrorResponse(res.body);
                });
        });

        it('returns a 400 error for an invalid product variant id', function() {
            return chai.request(env.openwhiskEndpoint)
                .post(env.cartsPackage + 'postCartEntry')
                .query({
                    quantity: 1,
                    id: cartId,
                    productVariantId: '526dc571-104f-40fb-b761-71781a97910b'
                })
                .set('Accept-Language', 'en-US')
                .set('cookie', `${OAUTH_TOKEN_NAME}=${accessToken};`)
                .then(function(res) {
                    expect(res).to.have.status(HttpStatus.BAD_REQUEST);
                    expect(res).to.be.json;
                    requiredFields.verifyErrorResponse(res.body);
                });
        });

        it('returns a 400 error for a non existent product variant id', function() {
            return chai.request(env.openwhiskEndpoint)
                .post(env.cartsPackage + 'postCartEntry')
                .query({
                    quantity: 1,
                    id: cartId,
                    productVariantId: 'does-not-exist'
                })
                .set('Accept-Language', 'en-US')
                .set('cookie', `${OAUTH_TOKEN_NAME}=${accessToken};`)
                .then(function(res) {
                    expect(res).to.have.status(HttpStatus.BAD_REQUEST);
                    expect(res).to.be.json;
                    requiredFields.verifyErrorResponse(res.body);
                });
        });

        it('returns a 404 error for adding a product to a non existent cart', function() {
            return chai.request(env.openwhiskEndpoint)
                .post(env.cartsPackage + 'postCartEntry')
                .query({
                    quantity: 1,
                    id: 'does-not-exist',
                    productVariantId: productVariantId
                })
                .set('Accept-Language', 'en-US')
                .set('cookie', `${OAUTH_TOKEN_NAME}=${accessToken};`)
                .then(function(res) {
                    expect(res).to.have.status(HttpStatus.NOT_FOUND);
                    expect(res).to.be.json;
                    requiredFields.verifyErrorResponse(res.body);
                });
        });

        it('returns a 400 error for missing parameters', function() {
            return chai.request(env.openwhiskEndpoint)
                .post(env.cartsPackage + 'postCartEntry')
                .set('Accept-Language', 'en-US')
                .set('cookie', `${OAUTH_TOKEN_NAME}=${accessToken};`)
                .then(function(res) {
                    expect(res).to.have.status(HttpStatus.BAD_REQUEST);
                    expect(res).to.be.json;
                    requiredFields.verifyErrorResponse(res.body);
                });
        });

    });
});