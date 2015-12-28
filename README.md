# homebridge-rasppi-gpio-garagedoor
Raspberry Pi GPIO GarageDoor plugin for [HomeBridge](https://github.com/nfarina/homebridge)

# Installation

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


