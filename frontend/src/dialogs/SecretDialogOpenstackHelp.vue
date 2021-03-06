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
   <secret-dialog-help
     title="About OpenStack Secrets"
     color="orange"
     backgroundSrc="/static/background_openstack.svg"
     :value="value"
     @input="onInput">
     <div slot="help-content" class="helpContent">
      <p>
        Before you can provision and access a Kubernetes cluster on OpenStack, you need to add account credentials.
        The Gardener needs the credentials to provision and operate the OpenStack infrastructure for your Kubernetes cluster.
      </p>
      <p>
        Ensure that the user has privileges to <b>create, modify and delete VMs</b>.
      </p>
      <p>
        Read the
        <a href="https://docs.openstack.org/horizon/latest/admin/admin-manage-roles.html"
           target="_blank"
           class="orange--text text--darken-2">
          OpenStack help section<v-icon style="font-size:80%">mdi-open-in-new</v-icon></a> on how to create and manage roles.
      </p>
    </div>
  </secret-dialog-help>
</template>

<script>
  import SecretDialogHelp from '@/dialogs/SecretDialogHelp'

  export default {
    components: {
      SecretDialogHelp
    },
    props: {
      value: {
        type: Boolean,
        required: true
      }
    },
    methods: {
      onInput (value) {
        this.$emit('input', value)
      }
    }
  }
</script>



<style lang="styl" scoped>

  .helpContent {
    a {
      text-decoration: none;
    }
    h1 {
      font-size:22px;
      font-weight:400;
    }
    p {
      font-size:16px
      font-weight:300;
    }
  }

</style>
