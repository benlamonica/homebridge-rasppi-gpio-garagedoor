var fs = require('fs');
var Service, Characteristic, DoorState; // set in the module.exports, from homebridge
var process = require('process');

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  DoorState = homebridge.hap.Characteristic.CurrentDoorState;

  homebridge.registerAccessory("homebridge-rasppi-gpio-garagedoor", "RaspPiGPIOGarageDoor", RaspPiGPIOGarageDoorAccessory);
}

function getVal(config, key, defaultVal) {
    var val = config[key];
    if (val == null) {
        return defaultVal;
    }
    return val;
}

function RaspPiGPIOGarageDoorAccessory(log, config) {
  this.log = log;
  this.version = require('./package.json').version;
  log("RaspPiGPIOGarageDoorAccessory version " + this.version);

  if (process.geteuid() != 0) {
    log("WARN! WARN! WARN! may not be able to control GPIO pins because not running as root!");
  }

  this.name = config["name"];
  this.doorSwitchPin = config["doorSwitchPin"];
  this.relayOn = getVal(config, "doorSwitchValue", 1);
  this.relayOff = 1-this.relayOn; //opposite of relayOn (O/1)
  this.doorSwitchPressTimeInMs = getVal(config, "doorSwitchPressTimeInMs", 1000);
  this.closedDoorSensorPin = getVal(config, "closedDoorSensorPin", config["doorSensorPin"]);
  this.openDoorSensorPin = config["openDoorSensorPin"];
  this.sensorPollInMs = getVal(config, "doorPollInMs", 4000);
  this.doorOpensInSeconds = config["doorOpensInSeconds"];
  this.closedDoorSensorValue = getVal(config, "closedDoorSensorValue", 1);
  this.openDoorSensorValue = getVal(config, "openDoorSensorValue", 1);
  log("Door Switch Pin: " + this.doorSwitchPin);
  log("Door Switch Val: " + (this.relayOn == 1 ? "ACTIVE_HIGH" : "ACTIVE_LOW"));
  log("Door Switch Active Time in ms: " + this.doorSwitchPressTimeInMs);

  if (this.hasClosedSensor()) {
      log("Door Closed Sensor: Configured");
      log("    Door Closed Sensor Pin: " + this.closedDoorSensorPin);
      log("    Door Closed Sensor Val: " + (this.closedDoorSensorValue == 1 ? "ACTIVE_HIGH" : "ACTIVE_LOW"));
  } else {
      log("Door Closed Sensor: Not Configured");
  }

  if(this.hasOpenSensor()) {
      log("Door Open Sensor: Configured");
      log("    Door Open Sensor Pin: " + this.openDoorSensorPin);
      log("    Door Open Sensor Val: " + (this.openDoorSensorValue == 1 ? "ACTIVE_HIGH" : "ACTIVE_LOW"));
  } else {
      log("Door Open Sensor: Not Configured");
  }

  if (!this.hasClosedSensor() && !this.hasOpenSensor()) {
      log("NOTE: Neither Open nor Closed sensor is configured. Will be unable to determine what state the garage door is in, and will rely on last known state.");
  }
  log("Sensor Poll in ms: " + this.sensorPollInMs);
  log("Door Opens in seconds: " + this.doorOpensInSeconds);
  this.initService();
}

RaspPiGPIOGarageDoorAccessory.prototype = {

  determineCurrentDoorState: function() {
       if (this.isClosed()) {
         return DoorState.CLOSED;
       } else if (this.hasOpenSensor()) {
         return this.isOpen() ? DoorState.OPEN : DoorState.STOPPED; 
       } else {
         return DoorState.OPEN;
       }
  },
  
  doorStateToString: function(state) {
    switch (state) {
      case DoorState.OPEN:
        return "OPEN";
      case DoorState.CLOSED:
        return "CLOSED";
      case DoorState.STOPPED:
        return "STOPPED";
      default:
        return "UNKNOWN";
    }
  },

  monitorDoorState: function() {
     var isClosed = this.isClosed();
     var isOpen = this.isOpen();
     if (isClosed != this.wasClosed) {
       var state = this.determineCurrentDoorState();
       if (!this.operating) {
         this.log("Door state changed to " + this.doorStateToString(state));
         this.wasClosed = isClosed;
         this.currentDoorState.setValue(state);
         this.targetState = state;
       }
     }
     setTimeout(this.monitorDoorState.bind(this), this.sensorPollInMs);
  },

  hasOpenSensor : function() {
    return this.openDoorSensorPin != null;
  },

  hasClosedSensor : function() {
    return this.closedDoorSensorPin != null;
  },

  initService: function() {
    this.garageDoorOpener = new Service.GarageDoorOpener(this.name,this.name);
    this.currentDoorState = this.garageDoorOpener.getCharacteristic(DoorState);
    this.currentDoorState.on('get', this.getState.bind(this));
    this.targetDoorState = this.garageDoorOpener.getCharacteristic(Characteristic.TargetDoorState);
    this.targetDoorState.on('set', this.setState.bind(this));
    this.targetDoorState.on('get', this.getTargetState.bind(this));
    var isClosed = this.hasClosedSensor() ? this.isClosed() : true;

    this.wasClosed = isClosed;
    this.operating = false;
    this.infoService = new Service.AccessoryInformation();
    this.infoService
      .setCharacteristic(Characteristic.Manufacturer, "Opensource Community")
      .setCharacteristic(Characteristic.Model, "RaspPi GPIO GarageDoor")
      .setCharacteristic(Characteristic.SerialNumber, "Version 1.0.0");
  
    if (this.hasOpenSensor() || this.hasClosedSensor()) {
        this.log("We have a door sensor, monitoring door state enabled.");
        setTimeout(this.monitorDoorState.bind(this), this.sensorPollInMs);
    }

    this.log("Initial Door State: " + (isClosed ? "CLOSED" : "OPEN"));
    this.currentDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
    this.targetDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
  },

  getTargetState: function(callback) {
    callback(null, this.targetState);
  },

  readPin: function(pin) {
      return parseInt(fs.readFileSync("/sys/class/gpio/gpio"+pin+"/value", "utf8").trim());
  },

  writePin: function(pin,val) {
      fs.writeFileSync("/sys/class/gpio/gpio"+pin+"/value", val.toString());
  },

  isClosed: function() {
    if (this.hasClosedSensor()) {
        return this.readPin(this.closedDoorSensorPin) == this.closedDoorSensorValue;
    } else if (this.hasOpenSensor()) {
        return !this.isOpen();
    } else {
        return this.wasClosed;
    }
  },

  isOpen: function() {
    if (this.hasOpenSensor()) {
        return this.readPin(this.closedDoorSensorPin) == this.closedDoorSensorValue;
    } else if (this.hasClosedSensor()) {
        return !this.isClosed();
    } else {
        return !this.wasClosed;
    }
  },

  switchOn: function() {
    this.writePin(this.doorSwitchPin, this.relayOn);
    this.log("Turning on GarageDoor Relay, pin " + this.doorSwitchPin + " = " + this.relayOn);
    setTimeout(this.switchOff.bind(this), this.doorSwitchPressTimeInMs);
  },

  switchOff: function() {
    this.writePin(this.doorSwitchPin, this.relayOff);
    this.log("Turning off GarageDoor Relay, pin " + this.doorSwitchPin + " = " + this.relayOff);
  },

  setFinalDoorState: function() {
    var isClosed = this.isClosed();
    var isOpen = this.isOpen();
    if ((this.hasClosedSensor() && this.targetState == DoorState.CLOSED && !isClosed) || (this.hasOpenSensor() && this.targetState == DoorState.OPEN && !isOpen)) {
      this.log("Was trying to " + (this.targetState == DoorState.CLOSED ? "CLOSE" : "OPEN") + " the door, but it is still " + (isClosed ? "CLOSED":"OPEN"));
      this.currentDoorState.setValue(DoorState.STOPPED);
    } else {
      this.log("Set current state to " + (this.targetState == DoorState.CLOSED ? "CLOSED" : "OPEN"));
      this.wasClosed = this.targetState == DoorState.CLOSED;
      this.currentDoorState.setValue(this.targetState);
    }
    this.operating = false;
  },

  setState: function(state, callback) {
    this.log("Setting state to " + state);
    this.targetState = state;
    var isClosed = this.isClosed();
    if ((state == DoorState.OPEN && isClosed) || (state == DoorState.CLOSED && !isClosed)) {
        this.log("Triggering GarageDoor Relay");
        this.operating = true;
        if (state == DoorState.OPEN) {
            this.currentDoorState.setValue(DoorState.OPENING);
        } else {
            this.currentDoorState.setValue(DoorState.CLOSING);
        }
	setTimeout(this.setFinalDoorState.bind(this), this.doorOpensInSeconds * 1000);
	this.switchOn();
    }

    callback();
    return true;
  },

  getState: function(callback) {
    var isClosed = this.isClosed();
    var isOpen = this.isOpen();
    var state = isClosed ? DoorState.CLOSED : isOpen ? DoorState.OPEN : DoorState.STOPPED;
    this.log("GarageDoor is " + (isClosed ? "CLOSED ("+DoorState.CLOSED+")" : isOpen ? "OPEN ("+DoorState.OPEN+")" : "STOPPED (" + DoorState.STOPPED + ")")); 
    callback(null, state);
  },

  getServices: function() {
    return [this.infoService, this.garageDoorOpener];
  }
};
