<script type="text/ecmascript-6">
    export default {
        data() {
            return {
                entry: null,
                batch: [],
                // Request and response each own their tab state, so switching
                // the response view does not throw away the payload you were
                // reading — the two cards are meant to be read side by side.
                currentRequestTab: 'payload',
                currentResponseTab: 'response'
            };
        }
    }
</script>

<template>
    <preview-screen title="Request Details" resource="requests" :id="$route.params.id" entry-point="true">
        <template slot="table-parameters" slot-scope="slotProps">
        <tr>
            <td class="table-fit font-weight-bold">Method</td>
            <td>
                {{slotProps.entry.content.method}}
            </td>
        </tr>

        <tr v-if="slotProps.entry.content.controller_action">
            <td class="table-fit font-weight-bold">Controller Action</td>
            <td>
                {{slotProps.entry.content.controller_action}}
            </td>
        </tr>

        <tr v-if="slotProps.entry.content.middleware">
            <td class="table-fit font-weight-bold">Middleware</td>
            <td>
                {{slotProps.entry.content.middleware.join(", ")}}
            </td>
        </tr>

        <tr>
            <td class="table-fit font-weight-bold">Path</td>
            <td>
                {{slotProps.entry.content.uri}}
            </td>
        </tr>

        <tr>
            <td class="table-fit font-weight-bold">Status</td>
            <td>
                {{slotProps.entry.content.response_status}}
            </td>
        </tr>

        <tr>
            <td class="table-fit font-weight-bold">Duration</td>
            <td>
                {{slotProps.entry.content.duration || '-'}} ms
            </td>
        </tr>

        <tr>
            <td class="table-fit font-weight-bold">IP Address</td>
            <td>
                {{slotProps.entry.content.ip_address || '-'}}
            </td>
        </tr>

        <tr>
            <td class="table-fit font-weight-bold">Memory usage</td>
            <td>
                {{slotProps.entry.content.memory || '-'}} MB
            </td>
        </tr>
        </template>

        <div slot="after-attributes-card" slot-scope="slotProps">
            <!-- What came in -->
            <div class="card mt-5 overflow-hidden">
                <ul class="nav nav-pills">
                    <li class="nav-item">
                        <a class="nav-link" :class="{active: currentRequestTab=='payload'}" href="#" v-on:click.prevent="currentRequestTab='payload'">Payload</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" :class="{active: currentRequestTab=='headers'}" href="#" v-on:click.prevent="currentRequestTab='headers'">Headers</a>
                    </li>
                </ul>
                <div class="code-bg p-4 mb-0 text-white">
                    <vue-json-pretty :data="slotProps.entry.content[currentRequestTab]"></vue-json-pretty>
                </div>
            </div>

            <!-- What went out -->
            <div class="card mt-5 overflow-hidden">
                <ul class="nav nav-pills">
                    <li class="nav-item">
                        <a class="nav-link" :class="{active: currentResponseTab=='response'}" href="#" v-on:click.prevent="currentResponseTab='response'">Response</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" :class="{active: currentResponseTab=='response_headers'}" href="#" v-on:click.prevent="currentResponseTab='response_headers'">Headers</a>
                    </li>
                    <!-- Guarded: this port has no session watcher, so the tab
                         only appears once something actually records one. -->
                    <li class="nav-item" v-if="slotProps.entry.content.session">
                        <a class="nav-link" :class="{active: currentResponseTab=='session'}" href="#" v-on:click.prevent="currentResponseTab='session'">Session</a>
                    </li>
                </ul>
                <div class="code-bg p-4 mb-0 text-white">
                    <vue-json-pretty :data="slotProps.entry.content[currentResponseTab]"></vue-json-pretty>
                </div>
            </div>

            <!-- Additional Information -->
            <related-entries :entry="entry" :batch="batch">
            </related-entries>
        </div>
    </preview-screen>
</template>
