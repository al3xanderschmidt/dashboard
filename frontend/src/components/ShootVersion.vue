<!--
Copyright (c) 2018 by SAP SE or an SAP affiliate company. All rights reserved. This file is licensed under the Apache Software License, v. 2 except as noted otherwise in the LICENSE file

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

<template>
  <div>
    <v-tooltip top>
      <v-btn slot="activator" class="update_btn" :class="buttonInactive" small round
        @click="showUpdateDialog"
        :outline="!k8sPatchAvailable"
        :dark="k8sPatchAvailable"
        color="cyan darken-2">
          <v-icon small v-if="availableK8sUpdates">arrow_drop_up</v-icon>
          {{k8sVersion}}
      </v-btn>
      <span v-if="k8sPatchAvailable">Kubernetes patch available</span>
      <span v-else-if="availableK8sUpdates">Kubernetes upgrade available</span>
      <span v-else>Kubernetes version up to date</span>
    </v-tooltip>
    <confirm-dialog
      :confirm="confirm"
      v-model="updateDialog"
      :cancel="hideUpdateDialog"
      :ok="versionUpdateConfirmed"
      :confirmDisabled="selectedVersionInvalid"
      :errorMessage.sync="updateErrorMessage"
      :detailedErrorMessage.sync="updateDetailedErrorMessage"
      confirmColor="orange"
      >
      <template slot="caption">Update Cluster</template>
      <template slot="affectedObjectName">{{shootName}}</template>
      <template slot="message">
        <shoot-version-update
          :availableK8sUpdates="availableK8sUpdates"
          :selectedVersion.sync="selectedVersion"
          :selectedVersionInvalid.sync="selectedVersionInvalid"
          :confirmRequired.sync="confirmRequired"
        ></shoot-version-update>
        <template v-if="!selectedVersionInvalid && confirmRequired">
          You should always back up all your data before attempting an upgrade. Don’t forget to include the workload inside your cluster!<br />
          Type <b>{{shootName}}</b> below and confirm to upgrade the Kubernetes version of your cluster.<br />
          <i class="orange--text text--darken-2">This action cannot be undone.</i>
        </template>
      </template>
    </confirm-dialog>
  </div>
</template>

<script>
  import ShootVersionUpdate from '@/components/ShootVersionUpdate'
  import ConfirmDialog from '@/dialogs/ConfirmDialog'
  import get from 'lodash/get'
  import { updateShootVersion } from '@/utils/api'

  export default {
    components: {
      ShootVersionUpdate,
      ConfirmDialog
    },
    props: {
      availableK8sUpdates: {
        type: Object
      },
      k8sVersion: {
        type: String
      },
      shootName: {
        type: String
      },
      shootNamespace: {
        type: String
      }
    },
    data () {
      return {
        updateDialog: false,
        selectedVersion: undefined,
        selectedVersionInvalid: false,
        confirmRequired: undefined,
        updateErrorMessage: null,
        updateDetailedErrorMessage: null
      }
    },
    computed: {
      k8sPatchAvailable () {
        if (get(this.availableK8sUpdates, 'patch')) {
          return true
        }
        return false
      },
      buttonInactive () {
        return this.availableK8sUpdates ? '' : 'update_btn_inactive'
      },
      confirm () {
        return this.confirmRequired ? this.shootName : undefined
      }
    },
    methods: {
      showUpdateDialog () {
        if (this.availableK8sUpdates) {
          this.updateDialog = true
        }
      },
      hideUpdateDialog () {
        this.updateDialog = false
        this.updateErrorMessage = null
        this.updateDetailedErrorMessage = null
        this.selectedVersion = null
      },
      versionUpdateConfirmed () {
        const user = this.$store.state.user
        updateShootVersion({namespace: this.shootNamespace, name: this.shootName, user, data: {version: this.selectedVersion}})
          .then(() => this.hideUpdateDialog())
          .catch((err) => {
            this.updateErrorMessage = 'Update Kubernetes version failed'
            this.updateDetailedErrorMessage = err.message
            console.error('Update shoot version failed with error:', err)
          })
      }
    },
    created () {
      this.$bus.$on('esc-pressed', () => {
        this.hideUpdateDialog()
      })
    }
  }
</script>

<style lang="styl" scoped>
  .update_btn {
    min-width: 0px;
  }

  .update_btn >>> i {
    margin-left: -8px;
  }

  .update_btn_inactive {
    cursor: default;
  }
</style>