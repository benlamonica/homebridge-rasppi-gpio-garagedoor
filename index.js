var fs = require("fs");
var wpi = require('wiring-pi');
var Service, Characteristic, DoorState; // set in the module.exports, from homebridge

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  DoorState = homebridge.hap.Characteristic.CurrentDoorState;

  homebridge.registerAccessory("homebridge-rasppi-gpio-garagedoor", "RaspPiGPIOGarageDoor", RaspPiGPIOGarageDoorAccessory);
}

function RaspPiGPIOGarageDoorAccessory(log, config) {
  this.log = log;
  this.name = config["name"];
  this.doorSwitchPin = config["doorSwitchPin"];
  this.doorSensorPin = config["doorSensorPin"];
  this.doorPollInMs = config["doorPollInMs"];
  this.doorOpensInSeconds = config["doorOpensInSeconds"];
  this.doorClosesInSeconds = config["doorClosesInSeconds"];
  this.relayOn = config["relayOnValue"]; //define value for on (0/1)
  this.relayOff = 1-this.relayOn; //opposite of relayOn (O/1)
  this.sensorClosed = config["sensorClosedValue"]; //define value for boolean On;
  log("Door Switch Pin: " + this.doorSwitchPin);
  log("Door Sensor Pin: " + this.doorSensorPin);
  log("Door Poll in ms: " + this.doorPollInMs);
  log("Door Opens in seconds: " + this.doorOpensInSeconds);
  this.initService();
  setTimeout(this.monitorDoorState.bind(this), this.doorPollInMs);
}

RaspPiGPIOGarageDoorAccessory.prototype = {

  // monitorDoorState: function() {
  //    var isClosed = this.isClosed();
  //    if (isClosed != this.wasClosed) {
  //      this.wasClosed = isClosed;
  //      var state = isClosed ? DoorState.CLOSED : DoorState.OPEN;
  //      this.log("Door state changed to " + (isClosed ? "CLOSED" : "OPEN"));
  //      if (!this.operating) {
  //        this.currentDoorState.setValue(state);
  //        this.targetDoorState.setValue(state);
  //        this.targetState = state;
  //      }
  //    }
  //    setTimeout(this.monitorDoorState.bind(this), this.doorPollInMs);
  // },
  
  monitorDoorState: function() {
     var isClosed = this.isClosed();
	 
	 // if it's opening, show that and schedule a time to go back and check/update.
	 // if it's closing, show that and schedule a time to go back and check/update.
	 
	 // status change detected
     if (isClosed != this.wasClosed) {
       this.wasClosed = isClosed;
	   var state = isClosed ? DoorState.CLOSED : DoorState.OPEN;
       this.log("Door state changed to " + (isClosed ? "CLOSED" : "OPEN"));
	   
       if (!this.operating) {
		 this.log("--------Setting states to " + state);
         this.currentDoorState.setValue(state);
         this.targetDoorState.setValue(state);
         this.targetState = state;
		 
       }
     }
	 
     setTimeout(this.monitorDoorState.bind(this), this.doorPollInMs);
  },
  

  initService: function() {
    wpi.setup('phys');
    wpi.pinMode(this.doorSwitchPin, wpi.OUTPUT);
	this.switchOff();	
	wpi.pinMode(this.doorSensorPin, wpi.INPUT);
	
    this.garageDoorOpener = new Service.GarageDoorOpener(this.name,this.name);
    this.currentDoorState = this.garageDoorOpener.getCharacteristic(DoorState);
    this.currentDoorState.on('get', this.getState.bind(this));
    this.targetDoorState = this.garageDoorOpener.getCharacteristic(Characteristic.TargetDoorState);
    this.targetDoorState.on('set', this.setState.bind(this));
    this.targetDoorState.on('get', this.getTargetState.bind(this));
    var isClosed = this.isClosed();
    this.currentDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
    this.targetDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
    this.infoService = new Service.AccessoryInformation();
    this.infoService
      .setCharacteristic(Characteristic.Manufacturer, "Opensource Community")
      .setCharacteristic(Characteristic.Model, "RaspPi GPIO GarageDoor")
      .setCharacteristic(Characteristic.SerialNumber, "Version 1.0.0");
  
    this.wasClosed = isClosed;
    this.operating = false;
    setTimeout(this.monitorDoorState.bind(this), this.doorPollInMs);
  },

  getTargetState: function(callback) {
    callback(null, this.targetState);
  },

  isClosed: function() {
    var isClosed = wpi.digitalRead(this.doorSensorPin) == this.sensorClosed;
	//this.log("isClosed: " + isClosed);
	return isClosed;
  },

  switchOff: function() {
    wpi.digitalWrite(this.doorSwitchPin, this.relayOff);
    this.log("Turning GarageDoor Relay Off");
  },

  switchOn: function() {
    wpi.digitalWrite(this.doorSwitchPin, this.relayOn);
    this.log("Turning GarageDoor Relay On");
  },

  // setFinalDoorState: function() {
  //   var isClosed = this.isClosed();
  //   if ((this.targetState == DoorState.CLOSED && !isClosed) || (this.targetState == DoorState.OPEN && isClosed)) {
  //     this.log("Was trying to " + (this.targetState == DoorState.CLOSED ? " CLOSE " : " OPEN ") + "the door, but it is still " + (isClosed ? "CLOSED":"OPEN"));
  //     this.currentDoorState.setValue(DoorState.STOPPED);
  //     this.targetDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
  //   } else {
  //     this.currentDoorState.setValue(this.targetState);
  //   }
  //   this.operating = false;
  // },
  
  setFinalDoorState: function() {
    var isClosed = this.isClosed();
    if ((this.targetState == DoorState.CLOSED && isClosed) || (this.targetState == DoorState.OPEN && !isClosed)) {
      this.log("It appears that the door is now " + (isClosed ? "CLOSED":"OPEN"));
	  this.log("Updating current state to" + this.targetState);
      this.currentDoorState.setValue(this.targetState);
      this.targetDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
    }
	this.operating = false;
	this.log("-------setFinalDoorState Called-------");
  },

  setState: function(state, callback) {
    this.log("Setting state to " + state);
	this.log("Current State appears to be " + this.targetState);
    this.targetState = state;
    var isClosed = this.isClosed();
    if ((state == DoorState.OPEN && isClosed) || (state == DoorState.CLOSED && !isClosed)) {
        this.log("Triggering GarageDoor Relay");
        this.operating = true; 
        if (state == DoorState.OPEN) {
			this.log("Opening Door");
            //this.currentDoorState.setValue(DoorState.OPENING);
			setTimeout(this.setFinalDoorState.bind(this), this.doorOpensInSeconds * 1000);
        } else {
			this.log("Closing Door");
            //this.currentDoorState.setValue(DoorState.CLOSING); //setting currentstate here fires an incorrect notification, rely on the finalDoorState
			setTimeout(this.setFinalDoorState.bind(this), this.doorClosesInSeconds * 1000);
        }
		
		this.switchOn();
        setTimeout(this.switchOff.bind(this), 1000);
    }

    callback();
    return true;
  },

  getState: function(callback) {
    var isClosed = this.isClosed();
    this.log("GarageDoor is " + (isClosed ? "CLOSED ("+DoorState.CLOSED+")" : "OPEN ("+DoorState.OPEN+")")); 
    callback(null, (isClosed ? DoorState.CLOSED : DoorState.OPEN));
  },

  getServices: function() {
    return [this.infoService, this.garageDoorOpener];
  }
};