# homebridge-rasppi-gpio-garagedoor
Raspberry Pi GPIO GarageDoor plugin for [HomeBridge](https://github.com/nfarina/homebridge)

# Circuit
  This plugin assumes that you are using a Raspberry Pi to directly control your garage door. Garage Door openers usually have
  a switch on the wall that you can push to open the garage door. On my model, this is just a very simple switch that completes
  a 24vdc circuit. The button must be pressed for about a second before the door will open. In order for this to be an effective
  garage door opener, you need two parts, a relay that will perform the duty of the button, and a reed switch that will
  detect when your garage door is closed.

  ![](https://raw.githubusercontent.com/benlamonica/homebridge-rasppi-gpio-garagedoor/master/images/Close_Sensor.jpg)

  ![](https://raw.githubusercontent.com/benlamonica/homebridge-rasppi-gpio-garagedoor/master/images/Relay_Wiring.jpg)

# Installation

## IMPORTANT NOTE ON PIN SELECTION 
When the Raspberry Pi reboots GPIO pins are reset to their default state. This can cause your garage door to open without you issuing a command. Please make sure you pick the correct pins so that you don't accidentally have your garage door opening after a power loss.

The following pins are pulled HIGH (they output a 3.3 volt signal) on reboot:
* GPIO0/2
* GPIO1/3
* GPIO4
* GPIO7
* GPIO8

GPIO14 is configured as a Serial Transmit line, so avoid choosing that pin.

All other pins are pulled LOW (they have a 0 volt signal, same as GND).

If you relay triggers when the GPIO PIN goes LOW, then pick a PIN that starts out HIGH on reboot. If your relay triggers with the GPIO PIN goes HIGH< then pick a PIN that starts out LOW on reboot.

(information comes from [(https://www.raspberrypi.org/forums/viewtopic.php?f=44&t=24491)

The one exception might be your pin 15, which looks like it must be GPIO14. However, this pin isn't a GPIO at startup - it's TxD, the serial transmit line - which may well be pulled high for normal TX operation. The TxD line won't become GPIO14 (and therefore go low) until you run your script that enables all 17 lines as GPIOs.
The Raspberry PI brings certain pins HIGH and others LOW on a reboot. This can cause  

  1. Export the GPIO pins to be used and set their direction after reboot  
    a. Copy and edit [this start script](https://raw.githubusercontent.com/benlamonica/homebridge-rasppi-gpio-garagedoor/master/scripts/garage-door-gpio) into your ```/etc/init.d``` directory.  
    b. Change the values to be the gpio pins that you are using.  
    c. ```chmod 755 /etc/init.d/garage-door-gpio``` # this makes the script executable   
    d. ```sudo update-rc.d /etc/init.d/garage-door-gpio defaults``` # this will set up the symlinks to run the script on startup.  
    e. ```sudo /etc/init.d/garage-door-gpio start``` and verify that your pins are exported by looking in ```ls /sys/class/gpio/``` directory  
  2. Install homebridge using: npm install -g homebridge
  3. Install this plugin using: npm install -g homebridge-rasppi-gpio-garagedoor
  4. Update your configuration file. See sample-config.json snippet below. 
  5. Set up Homebridge to start automatically after reboot  
    a. Copying the [homebridge start script](https://raw.githubusercontent.com/benlamonica/homebridge-rasppi-gpio-garagedoor/master/scripts/homebridge) into your ```/etc/init.d``` directory.  
    b. Modify the file to start homebridge with the .homebridge directory and user that you want. Make sure that the user you are choosing to run Homebridge as has access to write to GPIO pins. On my version of Raspbian, Homebridge has to run as ```root```.   
    c. ```chmod 755 /etc/init.d/homebridge```  
    d. ```sudo update-rc.d /etc/init.d/homebridge defaults```  
    e. ```sudo apt-get install apache2-utils``` # this will install rotatelog which is used in the start script so that the log can rotate and you can clean up diskspace  
    f. ```sudo /etc/init.d/homebridge start``` and verify that it is running. Logs are located at ~pi/.homebridge/  


# Configuration

Configuration sample:

 ```
    "accessories": [
        {
            "accessory": "RaspPiGPIOGarageDoor",
            "name": "Garage Door",
            "doorSwitchPin": 23,
            "doorSwitchPressTimeInMs": 1000,
            "doorSwitchValue": 1,
            "closedDoorSensorPin": 24,
            "closedDoorSensorValue": 1,
            "openDoorSensorPin": 25,
            "openDoorSensorValue": 1,
            "doorPollInMs": 4000,
            "doorOpensInSeconds": 14
        }
    ],
```

Fields: 

* name - Can be anything (required)
* doorSwitchPin - The physical GPIO pin number that controls the relay to trigger the garage door
* doorSwitchPressTimeInMs - number of milliseconds to trigger the garage door button. defaults to 1000 millseconds (1 second) if not specified
* doorSwitchValue - 1 = ACTIVE_HIGH, 0 = ACTIVE_LOW, defaults to 1 if not specified. Set to 0 if you have a relay that requires the signal to be 0v to trigger.
* closedDoorSensorPin - The physical GPIO pin that senses if the door is closed
* closedDoorSensorValue - 1 = ACTIVE_HIGH, 0 = ACTIVE_LOW, defaults to 1 if not specified
* openDoorSensorPin - The physical GPIO pin that senses if the door is open
* openDoorSensorValue - 1 = ACTIVE_HIGH, 0 = ACTIVE_LOW, defaults to 1 if not specified
* doorPollInMs - Number of milliseconds to wait before polling the doorSensorPin to report if the door is open or closed
* doorOpensInSeconds - Number of seconds it takes your garage door to open or close (err on the side of being longer than it actually takes)


