/*
 *
 * Copyright (c) 2019-present for NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License ");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import Lock from './lock'
import { Constants, filters } from '../config'
import helper from '../helper'
import {
  AccountService,
  MosaicService,
  NamespaceService,
  MultisigService,
  MetadataService,
  RestrictionService
} from '../infrastructure'
import {
  Filter,
  DataSet,
  Timeline,
  Pagination,
  getStateFromManagers,
  getGettersFromManagers,
  getMutationsFromManagers,
  getActionsFromManagers
} from './manager'

const managers = [
  new Timeline(
    'harvester',
    () => AccountService.getAccountList(Constants.PageSize, 'harvested/blocks'),
    (key, pageSize) => AccountService.getAccountList(pageSize, 'harvested/blocks', key),
    'address'
  ),
  new Filter(
    'timeline',
    {
      'harvester': 'Harvester List'
    }
  ),
  new DataSet(
    'info',
    (address) => AccountService.getAccountInfo(address)
  ),
  new DataSet(
    'OwnedMosaic',
    (address) => MosaicService.getMosaicAmountViewList(address)
  ),
  new Timeline(
    'OwnedNamespace',
    (pageSize, store) => NamespaceService.getNamespacesFromAccountList(store.getters.getCurrentAccountAddress, pageSize),
    (key, pageSize, store) => NamespaceService.getNamespacesFromAccountList(store.getters.getCurrentAccountAddress, pageSize, key),
    'metaId',
    10
  ),
  new DataSet(
    'multisig',
    (address) => MultisigService.getMultisigAccountInfo(address)
  ),
  new Pagination({
    name: 'transactions',
    fetchFunction: (pageInfo, filterValue, store) => AccountService.getAccountTransactionList(pageInfo, filterValue, store.getters.getCurrentAccountAddress),
    pageInfo: {
      pageSize: 10
    },
    filter: filters.transaction
  }),
  new Timeline(
    'metadatas',
    (pageSize, store) => MetadataService.getAccountMetadataList(store.getters.getCurrentAccountAddress, pageSize),
    (key, pageSize, store) => MetadataService.getAccountMetadataList(store.getters.getCurrentAccountAddress, pageSize, key),
    'id',
    10
  ),
  new DataSet(
    'restrictions',
    (address) => RestrictionService.getAccountRestrictionList(address)
  )
]

const LOCK = Lock.create()

export default {
  namespaced: true,
  state: {
    ...getStateFromManagers(managers),
    // If the state has been initialized.
    initialized: false,
    currentAccountAddress: null
  },
  getters: {
    ...getGettersFromManagers(managers),
    getInitialized: state => state.initialized,
    getActivityBucketList: state => state.info?.data.activityBucket || [],
    getSupplementalPublicKeys: state => state.info?.data.supplementalPublicKeys || [],
    getCurrentAccountAddress: state => state.currentAccountAddress
  },
  mutations: {
    ...getMutationsFromManagers(managers),
    setInitialized: (state, initialized) => { state.initialized = initialized },
    setCurrentAccountAddress: (state, currentAccountAddress) => { state.currentAccountAddress = currentAccountAddress }
  },
  actions: {
    ...getActionsFromManagers(managers),
    // Initialize the account model.
    async initialize({ commit, dispatch, getters }) {
      const callback = async () => {
        await dispatch('initializePage')
      }
      await LOCK.initialize(callback, commit, dispatch, getters)
    },

    // Uninitialize the account model.
    async uninitialize({ commit, dispatch, getters }) {
      const callback = async () => { getters.timeline?.uninitialize() }
      await LOCK.uninitialize(callback, commit, dispatch, getters)
    },

    // Fetch data from the SDK and initialize the page.
    initializePage(context) {
      context.getters.harvester.setStore(context)
      context.getters.timeline.setStore(context).initialFetch()
    },

    // Fetch data from the SDK By Address.
    async fetchAccountDetail(context, address) {
      if (!helper.isAccountAddress(address))
        address = await helper.decodeToAddress(address)

      context.dispatch('uninitializeDetail')
      context.commit('setCurrentAccountAddress', address)

      context.getters.info.setStore(context).initialFetch(address)
      context.getters.OwnedMosaic.setStore(context).initialFetch(address)
      context.getters.OwnedNamespace.setStore(context).initialFetch(address)
      context.getters.multisig.setStore(context).initialFetch(address)
      context.getters.transactions.setStore(context).initialFetch(address)
      context.getters.metadatas.setStore(context).initialFetch(address)
      context.getters.restrictions.setStore(context).initialFetch(address)
    },

    uninitializeDetail(context) {
      context.getters.info.setStore(context).uninitialize()
      context.getters.OwnedMosaic.setStore(context).uninitialize()
      context.getters.OwnedNamespace.setStore(context).uninitialize()
      context.getters.multisig.setStore(context).uninitialize()
      context.getters.transactions.setStore(context).uninitialize()
      context.getters.metadatas.setStore(context).uninitialize()
      context.getters.restrictions.setStore(context).uninitialize()
    }
  }
}
