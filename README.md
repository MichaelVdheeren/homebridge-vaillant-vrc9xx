# homebridge-vaillant-vrc9xx

A plugin for [homebridge](https://github.com/nfarina/homebridge), which allows to control Vaillant heater equipped with the VRC900 or VRC920 internet module.

It is a partial replacement for the multiMatic app available for iOS and Android.

## Added value

The vaillant app has been a source of frustration for me since the beginning especially:

-   the fact that it is very "slow" to acquire the connection with the home and give you a current reading of the system status (temperature, heating state, ...)
-   the fact that sometimes "commands" like changing temperature or activating a veto mode were not successful but it wouldn't let you know

The first point is definitelly fixed by this plugin as homebridge will poll vaillant API every minute and record the last known state. I think this continuous polling helps keeping the connection with the internet gateway alive and even if it is broken for some reason, you would still have the last know state.

The second point is not fully adressed for now. I plan to build in a better retry mechanism that would ensure your command eventually get executed even hours later one the connection with the gateway is restored.

Beside these points, integration with homekit bring additional benefits like richer automation (based on your location for example).

You can also adapt the temperature along the day (a bit cooler during the period of the day you are active and move a lot, a bit hotter when you are sitting in your coach watching TV).

I might eventually integrate predefined schedules that you could activate automatically (when you are away for the week-end for example).

## Status

[![HitCount](http://hits.dwyl.io/lmelon/homebridge-vaillant-vrc9xx.svg)](https://github.com/lmelon/homebridge-vaillant-vrc9xx)
[![Dependency Status](https://img.shields.io/david/lmelon/homebridge-vaillant-vrc9xx.svg?style=flat-square)](https://david-dm.org/lmelon/homebridge-vaillant-vrc9xx)
[![devDependency Status](https://img.shields.io/david/dev/lmelon/homebridge-vaillant-vrc9xx.svg?style=flat-square)](https://david-dm.org/lmelon/homebridge-vaillant-vrc9xx#info=devDependencies)
[![Node version](https://img.shields.io/node/v/homebridge-vaillant-vrc9xx.svg?style=flat)](http://nodejs.org/download/)
[![NPM Version](https://badge.fury.io/js/homebridge-vaillant-vrc9xx.svg?style=flat)](https://npmjs.org/package/homebridge-vaillant-vrc9xx)

## Supported Vaillant devices

-   VR900 (tested in combination with VRC700 thermostat)
-   VR920 (tested in combination with VR50)
-   VRC700
-   VR50

In theory any Vaillant heater that can be controlled with the multiMatic app (iOS and Android) should work too.

## Requirements

-   Node version 12
-   Homebridge 4.50

This might be an issue to upgrade an existing installation of homebridge. So remember that you can deploy a second (or third, ...) instance of homebridge next to an existing one: just change the username and port number in the config file.

## Installation

After [Homebridge](https://github.com/nfarina/homebridge) has been installed:

`sudo npm install -g homebridge-vaillant-vrc9xx`

## Configuration

```json
{
  "bridge": {
      ...
  },
  "platforms": [
    {
      "platform": "VaillantVRC9xx",
      "api": {
                "polling": 60,
                "user": {
                    "name": "username",
                    "password": "password",
                    "device": "1234-56789-1011"
                }
            }
    }
  ]
}
```

| Attributes | Usage                                                                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name       | The username used to connect the multiMatic app. I recommand creating a dedicated user for homebridge so that the plugin will never mess-up with your access. This is easily done from within the multiMatic app.                                                                                                   |
| password   | The password of this user                                                                                                                                                                                                                                                                                           |
| device     | A unique identifier used to identify the "device". Just select any random sequence of number.                                                                                                                                                                                                                       |
| polling    | The polling interval (in seconds) the plugin uses to retrieve the state of the system. The communication between the cloud api and the VRC9xx module seems to occur every minute or so. So the default value is 60. The minimal value is 30 to avoid performing a Denial-of-Service (DoS) attack on the API servers |

## How it works

This configuration will connect to Vaillant API servers and get the full state of the system and create:

-   Per _active_ "Zone":

    -   One _thermostat_
    -   One _temperature sensor_

> **Remark**
> As-of release 0.4.0, inactive zones are ignored and will not show up in homekit
> Zones for which individual rooms have been defined will not show up in homekit

-   Per _active_ "Room" (require ambiSENSE system with VR50 controlled valves):

    -   One _thermostat_
    -   One _temperature sensor_

-   Per "Hot Water Tank":

    -   One _thermostat_
    -   One _temperature sensor_

-   One _temperature sensor_ if your thermostat is connected with an external temperature sensor

-   Two "_Contact sensors_":
    -   One closed if the connection with the cloud is correctly working (will open if 2 consecutive refresh failed)
    -   One closed if the connection between cloud and gateway (VR9xx) is not stale (data is fresh enough)

### Heating zone

#### For Zones

The heating thermostat is fully functional. It will shows the current temperature in the room the thermostat is located as well as the target temperature.

The target shown depends on the heating state. The heater can be in 4 states: OFF (completelly stopped), Reduced (Night mode), Day, Auto (alternate between night and day according to the schedule).

Two temperatures can be programmed one for the day and one for the night.

In "OFF", "Day" or "Auto" mode, the target shown is the day temperature. This is the one you can control via the Apple Home app. In "Reduced" (Night) mode, the target temperature shown/controlled is the night temperature.

This is quite logical as you usually want to control the target temperation that is active now. If you want to control these two temperature individually, try the EVE app. It exposes two individual settings.

#### For Rooms

The heating thermostat is fully functional. It will shows the current temperature in the room the thermostat is located as well as the target temperature.

A single target temperature is available at any given time.
If the room contains a (battery powered) device with low battery, the thermostat will report low battery for the room.

### Domestic Hot Water

The domestic hot water is represented as a heating thermostat.
Only a single target temperature is available.

### Temperature Sensors

They come with historical data visible in the Eve app.
Some are duplicated from the current temperature in the thermosat for easier access.

### Contact Sensors

These sensors allow to monitor the connection between:

-   Homebridge and the cloud
-   The cloud and the gateway

Please not that is the connection between the cloud and the gateway is broken for some reason, after some time the connection between homebridge and the cloud will fail too.

This is because Vaillant through an error when the installation is disconnected and you cannot get the last known info.

It this situation occurs during startup of homebridge, the plugin will never finish its initial setup (until the connection can finally be established). That also mean the homebridge instance will not be available.

## Known limitations

-   Incorrect status for domestic hotwater. I have not been able to find a way to determine for sure if the boiler is actually currently heating the water tank. I might implement a heuristic based on the planning though (see roadmap)
-   No support for Fan and Cooling
-   Not dynamic: if you add or remove an installation (i.e. a home) or configure new zones, you have to relaunch the plugin for them to appear in homekit
-   Essentially tested in my personnal configuration which is a VRC900 internet gateway, the VRC700 thermostat and the VC306 boiler and a water tank.
-   ~~My installation has a single Home, a single "Zone", a single "Water Tank", no Fan, no Cooler. Although the code is written with the possibility of multiple of them (Home, Zone, ...), I cannot guarantee it will work. If you have multiple installation you MUST give them different names.~~ Thanks to a nice user of this pluggin who granted me access to his system, version 0.4.0 now support multiple zones and multiple installation. _Beware to give a different name to each installation._
-   ~~Limited error handling. Although it has worked for me quite long periods, sometimes the polling is broken and a restart is required. It is a stupid authentication issue. Just haven't found the time to fix it for now.~~ Has been dramatically improved in my last refactoring.

## Roadmap for enhancements

These are the few evolution that I have in mind. Do not hesitate to "vote" for them and/or to propose new items

-   Dynamically deal with new/deleted home, zones, ...
-   Allow to activate some predefined schedules (probably in the form of switches)
-   Provided a way to know if there is pending commands to be treated by the API
-   Use current schedule to determine if the hot water boiler is heating or not

Feel free to vote for your preferred features.

## Contributing

You can contribute to this homebridge plugin in following ways:

-   [Report issues](https://github.com/lmelon/homebridge-vaillant-vrc9xx/issues) and help verify fixes as they are checked in.
-   Review the [source code changes](https://github.com/lmelon/homebridge-vaillant-vrc9xx/pulls).
-   Contribute bug fixes.
-   Contribute changes to extend the capabilities

Pull requests are accepted.

## Comments and feedbacks

If you use this and like it - please leave a note by staring this package here or on GitHub.

If you use it and have a problem, file an issue at [GitHub](https://github.com/grover/homebridge-vaillant-vrc9xx/issues) - I'll try to help.

If you tried this, but don't like it: tell me about it in an issue too. I'll try my best to address these in my spare time.

If you fork this, go ahead - I'll accept pull requests for enhancements.

## License

MIT License

Copyright (c) 2019 L. Mélon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
