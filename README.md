# homebridge-rasppi-gpio-garagedoor
Raspberry Pi GPIO GarageDoor plugin for [HomeBridge](https://github.com/nfarina/homebridge)

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-rasppi-gpio-garagedoor
3. Update your configuration file. See sample-config.json snippet below. 

# Configuration

Configuration sample:

 ```
    "accessories": [
        {
            "accessory": "RaspPiGPIOGarageDoor",
            "name": "Garage Door",
            "doorSwitchPin": 23,
            "doorSensorPin": 24,
            "doorPollInMs": 4000,
            "doorOpensInSeconds": 14
        }
    ],
```

Fields: 

* "name": Can be anything (required)
* "doorSwitchPin": The GPIO pin that controls the relay to trigger the garage door
* "doorSensorPin": The GPIO pin that senses if the door is closed (Closed = HIGH, Open = LOW)
* "doorPollInMs": Number of milliseconds to wait before polling the doorSensorPin to report if the door is open or closed
* "doorOpensInSeconds": Number of seconds it takes your garage door to open or close (err on the side of being longer than it actually takes)

