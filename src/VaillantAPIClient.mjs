import _ from 'lodash'
import tough from 'tough-cookie'
import cookieJarSupport from 'axios-cookiejar-support'
import axios from 'axios'

const qwest = cookieJarSupport(axios)

class VRC9xxAPI {
    constructor(data, log) {
        this.auth = data
        this.log = log ? log : console.log
        this.cookieJar = new tough.CookieJar()
        this.commands = []
        this.timer = null
    }

    async query(url, method, data) {
        const query = {
            url,
            method,
            jar: this.cookieJar,
            withCredentials: true,
            type: 'json',
            baseURL: 'https://smart.vaillant.com/mobile/api/v4/',
        }

        if (data) {
            query.data = data
        }

        var count = 0
        while (count < 3) {
            try {
                const value = await this.executeQuery(query, count)
                return value
            } catch (e) {
                count++
                this.log(`Query failed (${count} times) retrying ...`)
            }
        }

        // try to logIn again
        const result = await this.logIn()
        if (result) {
            return await this.executeQuery(query, 0)
        }

        return null
    }

    async executeQuery(query, retry) {
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                try {
                    var resp = await qwest(query)
                    switch (resp.status) {
                        case 200:
                            resolve(resp)
                        default:
                            reject(resp.status)
                    }
                } catch (e) {
                    //this.log(e);
                    return reject(e)
                }
            }, retry * 5000)
        })
    }

    async queryBody(url, method, data) {
        try {
            const resp = await this.query(url, method, data)
            return resp.data.body
        } catch (e) {
            return null
        }
    }

    async logIn() {
        const url_authenticate = '/account/authentication/v1/token/new'
        const url_authorize = '/account/authentication/v1/authenticate'

        if (!this.auth.authToken) {
            var response = await this.query(url_authenticate, 'post', this.auth)
            if (!response) {
                return false
            }
            this.auth.authToken = response.data.body.authToken
            this.password = this.auth.password
            delete this.auth.password
        }

        const resp = await this.query(url_authorize, 'post', this.auth)
        if (!resp) {
            return false
        }

        return resp.status === 200
    }

    async getFacilities() {
        try {
            const url = '/facilities'
            const facilities = await this.query(url, 'get', null)
            return facilities.data.body.facilitiesList
        } catch (e) {
            return null
        }
    }

    async getFullSystem(facilitySerial) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/`
        return await this.queryBody(url, 'get', null)
    }

    async getStatus(facilitySerial) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/status`
        return await this.queryBody(url, 'get', null)
    }

    async getEmfLiveReport(facilitySerial) {
        const url = `/facilities/${facilitySerial}/livereport/v1`
        return await this.queryBody(url, 'get', null)
    }

    async getGateway(facilitySerial) {
        const url = `/facilities/${facilitySerial}/public/v1/gatewayType`
        return await this.queryBody(url, 'get', null)
    }

    async getFullState(facilitySerial) {
        try {
            const response = await Promise.all([
                this.getFullSystem(facilitySerial),
                this.getEmfLiveReport(facilitySerial),
                this.getStatus(facilitySerial),
                this.getGateway(facilitySerial),
            ])

            const info = _.zipObject(['system', 'measures', 'status', 'gateway'], response)

            // index zones by id
            info.system.zones = _.zipObject(info.system.zones.map(zone => zone._id), info.system.zones)

            // index dwh by id
            info.system.dhw = _.zipObject(info.system.dhw.map(dhw => dhw._id), info.system.dhw)

            let devices = info.measures.devices
            Object.keys(info.system.dhw).forEach(key => {
                let measures = []
                let reports = devices.find(item => item._id === key)
                if (reports) {
                    measures = reports.reports.filter(item => item.measurement_category === 'TEMPERATURE')
                }

                info.system.dhw[key].configuration = _.zipObject(measures.map(item => item._id), measures)
            })

            return info
        } catch (e) {
            return null
        }
    }

    enqueueCommand(command) {
        const index = _.findIndex(this.commands, item => {
            return item.url === command.url
        })
        if (index >= 0) {
            this.log('Similar command pending ... replacing')
            this.commands[index] = command
            return
        }

        this.commands.push(command)

        if (!this.timer) {
            this.timer = setTimeout(this.processQueue.bind(this), 500)
        }
    }

    async processQueue() {
        var command = this.commands.shift()
        while (command) {
            this.log('Processing command')
            await this.query(command.url, command.method, command.data)
            var command = this.commands.shift()
        }

        this.timer = null
    }

    async setTargetTemperature(facilitySerial, zone, temperature) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones/${zone}/heating/configuration/setpoint_temperature`

        const data = {
            setpoint_temperature: temperature,
        }

        this.enqueueCommand({
            url,
            data,
            method: 'put',
        })
    }

    async setTargetDHWTemperature(facilitySerial, dhw, temperature) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/dhw/${dhw}/hotwater/configuration/temperature_setpoint`

        const data = {
            temperature_setpoint: temperature,
        }

        this.enqueueCommand({
            url,
            data,
            method: 'put',
        })
    }

    async setTargetReducedTemperature(facilitySerial, zone, temperature) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones/${zone}/heating/configuration/setback_temperature`

        const data = {
            setback_temperature: temperature,
        }

        this.enqueueCommand({
            url,
            data,
            method: 'put',
        })
    }

    async setHeatingMode(facilitySerial, zone, mode) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones/${zone}/heating/configuration/mode`

        const data = {
            mode,
        }

        this.enqueueCommand({
            url,
            data,
            method: 'put',
        })
    }

    async setDHWOperationMode(facilitySerial, dhw, mode) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/dhw/${dhw}/hotwater/configuration/operation_mode`

        const data = {
            operation_mode: mode,
        }

        this.enqueueCommand({
            url,
            data,
            method: 'put',
        })
    }

    // *******************************************************************
    async getOverview(facilitySerial) {
        const url = `/facilities/${facilitySerial}/hvacstate/v1/overview`
        const info = await this.query(url, 'get', null)

        var json = JSON.stringify(info.data.body, null, 4)
        this.log(json)
    }

    async getZoneConfig(facilitySerial, zone) {
        const zone = 'Control_ZO1'
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones/${zone}`
        const info = await this.query(url, 'get', null)

        var json = JSON.stringify(info.data.body, null, 4)
        this.log(json)
    }

    async getZones(facilitySerial) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones`
        const zones = await this.query(url, 'get', null)
        return zones.data.body
    }

    async getDWHTimeprogram(facilitySerial, dhwIdentifier) {
        const dhwIdentifier = 'Control_DHW'
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/dhw/${dhwIdentifier}/hotwater/timeprogram`

        var timeprog = await this.query(url, 'get', null)
        var json = JSON.stringify(timeprog.data.body, null, 4)
        this.log(json)
    }

    async getZoneHeatingConfig(facilitySerial, zone) {
        const zone = 'Control_ZO1'
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones/${zone}/heating/configuration`
        const info = await this.query(url, 'get', null)

        var json = JSON.stringify(info.data.body, null, 4)
        this.log(json)
    }

    async getEmfReportForDevice() {
        const deviceId = 'Control_SYS_MultiMatic'
        const reportId = 'WaterPressureSensor'

        const url = `/facilities/${config.facilitySerial}/livereport/v1/devices/${deviceId}/reports/${reportId}`
        const info = await this.query(url, 'get', null)

        var json = JSON.stringify(info.data.body, null, 4)
        this.log(json)
    }

    async getZoneTimeprogram(facilitySerial, zone) {
        var zone = 'Control_ZO1'
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones/${zone}/heating/timeprogram`

        var timeprog = await this.query(url, 'get', null)
        var json = JSON.stringify(timeprog.data.body, null, 4)
        this.log(json)
    }

    async setZoneTimeprogram() {
        const zone = 'Control_ZO1'
        const timeschedule = await require('./ts.json')
        const url = `/facilities/${config.facilitySerial}/systemcontrol/v1/zones/${zone}/heating/timeprogram`

        var timeprog = await this.query(url, 'put', timeschedule)
        this.log(timeprog.status)
    }

    async getParameters(facilitySerial) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/parameters`
        const info = await this.query(url, 'get', null)
        return info.data.body
    }

    async getEvents(facilitySerial) {
        const url = `/facilities/${facilitySerial}/events/v1`
        const info = await this.query(url, 'get', null)

        return info.data.body
    }
}

export default VRC9xxAPI
