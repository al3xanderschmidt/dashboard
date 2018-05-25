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

import Vue from 'vue'
import assign from 'lodash/assign'
import forEach from 'lodash/forEach'
import pick from 'lodash/pick'
import map from 'lodash/map'
import get from 'lodash/get'
import replace from 'lodash/replace'
import transform from 'lodash/transform'
import isEqual from 'lodash/isEqual'
import isObject from 'lodash/isObject'
import orderBy from 'lodash/orderBy'
import toLower from 'lodash/toLower'
import padStart from 'lodash/padStart'
import { getShoot, getShootInfo, createShoot, deleteShoot } from '@/utils/api'
import { isNotFound } from '@/utils/error'
import { availableK8sUpdatesForShoot, isHibernated, getCloudProviderKind, isUserError } from '@/utils'

const uriPattern = /^([^:/?#]+:)?(\/\/[^/?#]*)?([^?#]*)(\?[^#]*)?(#.*)?/

const keyForShoot = ({name, namespace}) => {
  return `${name}_${namespace}`
}

const findItem = ({name, namespace}) => {
  return state.shoots[keyForShoot({name, namespace})]
}

// initial state
const state = {
  shoots: {},
  sortedShoots: [],
  sortParams: undefined,
  selection: undefined
}

// getters
const getters = {
  sortedItems (state) {
    return state.sortedShoots
  },
  itemByNameAndNamespace () {
    return ({namespace, name}) => {
      return findItem({name, namespace})
    }
  },
  selectedItem () {
    if (state.selection) {
      return findItem(state.selection)
    }
  }
}

// actions
const actions = {
  /**
   * Return all shoots in the given namespace.
   * This ends always in a server/backend call.
   */
  clearAll ({ commit, dispatch }) {
    commit('CLEAR_ALL')
    return getters.items
  },
  clearStale ({ commit, dispatch }) {
    commit('CLEAR_STALE')
    return getters.items
  },
  get ({ dispatch, commit, rootState }, {name, namespace}) {
    const user = rootState.user
    return getShoot({namespace, name, user})
      .then(res => {
        const item = res.data
        commit('ITEM_PUT', item)
      })
      .then(() => dispatch('getInfo', {name, namespace}))
      .then(() => findItem({name, namespace}))
      .catch(error => {
        // shoot info not found -> ignore if KubernetesError
        if (isNotFound(error)) {
          const item = findItem({namespace, name})
          if (item !== undefined) {
            Vue.set(item, 'dashboardData.notFound', true)
          }
          return
        }
        throw error
      })
  },
  create ({ dispatch, commit, rootState }, data) {
    const namespace = data.metadata.namespace || rootState.namespace
    const user = rootState.user
    return createShoot({namespace, user, data})
  },
  delete ({ dispatch, commit, rootState }, {name, namespace}) {
    const user = rootState.user
    return deleteShoot({namespace, name, user})
  },
  /**
   * Return the given info for a single shoot with the namespace/name.
   * This ends always in a server/backend call.
   */
  getInfo ({ commit, rootState }, {name, namespace}) {
    const user = rootState.user
    return getShootInfo({namespace, name, user})
      .then(res => res.data)
      .then(info => {
        if (info.serverUrl) {
          const [, scheme, host] = uriPattern.exec(info.serverUrl)
          const authority = `//${replace(host, /^\/\//, '')}`
          const pathnameAlias = '/ui'
          const pathname = get(rootState.cfg, 'dashboardUrl.pathname', pathnameAlias)
          info.dashboardUrl = [scheme, authority, pathname].join('')
          info.dashboardUrlText = [scheme, host, pathnameAlias].join('')
        }

        if (info.shootIngressDomain) {
          const grafanaPathname = get(rootState.cfg, 'grafanaUrl.pathname', '')
          const grafanaHost = `g.${info.shootIngressDomain}`
          info.grafanaUrl = `https://${grafanaHost}${grafanaPathname}`
          info.grafanaUrlText = `https://${grafanaHost}`

          const prometheusHost = `p.${info.shootIngressDomain}`
          info.prometheusUrl = `https://${prometheusHost}`

          const alertmanagerHost = `a.${info.shootIngressDomain}`
          info.alertmanagerUrl = `https://${alertmanagerHost}`
        }
        return info
      })
      .then(info => {
        commit('RECEIVE_INFO', {name, namespace, info})
        return info
      })
      .catch(error => {
        // shoot info not found -> ignore if KubernetesError
        if (isNotFound(error)) {
          const item = findItem({namespace, name})
          if (item !== undefined) {
            Vue.set(item, 'dashboardData.notFound', true)
          }
          return
        }
        throw error
      })
  },
  setSelection ({ commit, dispatch }, metadata) {
    if (!metadata) {
      return commit('SET_SELECTION', null)
    }
    const item = findItem(metadata)
    if (item) {
      commit('SET_SELECTION', pick(metadata, ['namespace', 'name']))
      if (!item.info) {
        return dispatch('getInfo', {name: metadata.name, namespace: metadata.namespace})
      }
    }
  },
  setSortParams ({ commit }, sortParams) {
    if (!isEqual(sortParams, state.sortParams)) {
      commit('SET_SORTPARAMS', pick(sortParams, ['sortBy', 'descending']))
    }
  }
}

// Deep diff between two object, using lodash
const difference = (object, base) => {
  function changes (object, base) {
    return transform(object, function (result, value, key) {
      if (!isEqual(value, base[key])) {
        result[key] = (isObject(value) && isObject(base[key])) ? changes(value, base[key]) : value
      }
    })
  }
  return changes(object, base)
}

const getRawSortVal = (item, sortBy) => {
  const metadata = item.metadata
  const spec = item.spec
  switch (sortBy) {
    case 'purpose':
      // eslint-disable-next-line
      return get(metadata, ['annotations', 'garden.sapcloud.io/purpose'])
    case 'lastOperation':
      return get(item, 'status.lastOperation')
    case 'createdAt':
      return metadata.creationTimestamp
    case 'project':
      return metadata.namespace
    case 'k8sVersion':
      return get(spec, 'kubernetes.version')
    case 'infrastructure':
      return getCloudProviderKind(spec.cloud)
    default:
      return metadata[sortBy]
  }
}

const getSortVal = (item, sortBy) => {
  const value = getRawSortVal(item, sortBy)
  const spec = item.spec
  switch (sortBy) {
    case 'purpose':
      switch (value) {
        case 'infrastructure':
          return 0
        case 'production':
          return 1
        case 'development':
          return 2
        case 'evaluation':
          return 3
        default:
          return 4
      }
    case 'lastOperation':
      const operation = value || {}
      const inProgress = operation.progress !== 100 && operation.state !== 'Failed' && !!operation.progress
      const isError = operation.state === 'Failed' || get(item, 'status.lastError')
      const userError = isUserError(get(item, 'status.lastError.codes', []))

      if (userError && !inProgress) {
        return 200
      } else if (userError && inProgress) {
        const progress = padStart(operation.progress, 2, '0')
        return `3${progress}`
      } else if (isError && !inProgress) {
        return 0
      } else if (isError && inProgress) {
        const progress = padStart(operation.progress, 2, '0')
        return `1${progress}`
      } else if (inProgress) {
        const progress = padStart(operation.progress, 2, '0')
        return `5${progress}`
      } else if (isHibernated(spec)) {
        return 400
      }
      return 600
    case 'k8sVersion':
      const k8sVersion = value
      const availableK8sUpdates = availableK8sUpdatesForShoot(spec)
      const sortPrefix = availableK8sUpdates ? '_' : ''
      return `${sortPrefix}${k8sVersion}`
    default:
      return toLower(value)
  }
}

const shoots = (state) => {
  return map(Object.keys(state.shoots), (key) => state.shoots[key])
}

const setSortedItems = (state) => {
  const sortBy = get(state, 'sortParams.sortBy')
  const descending = get(state, 'sortParams.descending', false) ? 'desc' : 'asc'
  if (sortBy) {
    state.sortedShoots = orderBy(shoots(state), ['dashboardData.stale', item => getSortVal(item, sortBy), 'metadata.name'], ['desc', descending, 'asc'])
  } else {
    state.sortedShoots = shoots(state)
  }
}

const putItem = (state, newItem) => {
  const item = findItem(newItem.metadata)
  if (item !== undefined) {
    if (item.metadata.resourceVersion !== newItem.metadata.resourceVersion) {
      // eslint-disable-next-line lodash/path-style
      if (!get(item, 'dashboardData.stale') || !!get(newItem, ['metadata', 'labels', 'shoot.garden.sapcloud.io/unhealthy'])) {
        // do not update stale shoots, except stale shoot became unhealthy again, in this case the stale flag will be removed
        const sortBy = get(state, 'sortParams.sortBy')
        let sortRequired = true
        if (sortBy === 'name' || sortBy === 'infrastructure' || sortBy === 'project' || sortBy === 'createdAt' || sortBy === 'createdBy') {
          sortRequired = false // these values cannot change
        } else if (sortBy !== 'lastOperation') { // don't check in this case as most put events will be lastOperation anyway
          const changes = difference(item, newItem)
          const sortBy = get(state, 'sortParams.sortBy')
          if (!getRawSortVal(changes, sortBy)) {
            sortRequired = false
          }
        }
        if (get(item, 'dashboard.stale') === true) {
          // shoot previously had an error, recovered and now became unhealthy again
          Vue.set(item, 'dashboardData.stale', false)
          sortRequired = true
        }

        Vue.set(state.shoots, keyForShoot(item.metadata), assign(item, newItem))
        return sortRequired
      }
    }
  } else {
    Vue.set(state.shoots, keyForShoot(newItem.metadata), newItem)
    return true
  }
}

const deleteItem = (state, rootState, deletedItem) => {
  const item = findItem(deletedItem.metadata)
  let sortRequired = false
  if (item !== undefined) {
    if (rootState.namespace === '_all' && rootState.onlyShootsWithIssues) {
      Vue.set(item, 'dashboardData.stale', true)
    } else {
      delete state.shoots[keyForShoot(item.metadata)]
      sortRequired = true
    }
  }
  return sortRequired
}

// mutations
const mutations = {
  RECEIVE_INFO (state, { namespace, name, info }) {
    const item = findItem({namespace, name})
    if (item !== undefined) {
      Vue.set(item, 'info', info)
    }
  },
  SET_SELECTION (state, metadata) {
    state.selection = metadata
  },
  SET_SORTPARAMS (state, sortParams) {
    state.sortParams = sortParams
    setSortedItems(state)
  },
  ITEM_PUT (state, newItem) {
    const sortRequired = putItem(state, newItem)

    if (sortRequired) {
      setSortedItems(state)
    }
  },
  REMOVE_FROM_STORE (state, {deletedItem, rootState}) {
    const item = findItem(deletedItem.metadata)
    if (item !== undefined) {
      delete state.shoots[keyForShoot(item.metadata)]
      setSortedItems(state)
    }
  },
  HANDLE_EVENTS (state, {rootState, events}) {
    let sortRequired = false
    forEach(events, event => {
      switch (event.type) {
        case 'ADDED':
        case 'MODIFIED':
         // eslint-disable-next-line lodash/path-style
          if (rootState.namespace !== '_all' || rootState.onlyShootsWithIssues === !!get(event.object, ['metadata', 'labels', 'shoot.garden.sapcloud.io/unhealthy'])) {
            // Do not add healthy shoots when onlyShootsWithIssues=true, this can happen when toggeling flag
            if (putItem(state, event.object)) {
              sortRequired = true
            }
          }
          break
        case 'DELETED':
          if (deleteItem(state, rootState, event.object)) {
            sortRequired = true
          }
          break
        default:
          console.error('undhandled event type', event.type)
      }
    })
    if (sortRequired) {
      setSortedItems(state)
    }
  },
  CLEAR_ALL (state) {
    state.shoots = {}
    state.sortedShoots = []
  },
  CLEAR_STALE (state) {
    forEach(state.shoots, shoot => {
      if (get(shoot, 'dashboardData.stale') === true) {
        delete state.shoots[keyForShoot(shoot.metadata)]
      }
    })
    setSortedItems(state)
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
