const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Cvc = imports.gi.Cvc;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const {VolumeSlider} = require('./VolumeSlider');
const {MultiIconApplet} = require('./MultiIconApplet');


const CINNAMON_DESKTOP_SOUNDS = "org.cinnamon.desktop.sound";
const MAXIMUM_VOLUME_KEY = "maximum-volume";
const VOLUME_ADJUSTMENT_STEP = 0.04; /* Volume adjustment step in % */
const setup = {
	SPEAKERS: {
		"_output": "::Auto-Falantes com echo-canceling",
		"_input": "::Boya BY-MM1"
	},
	HEADSET: {
		"_output": "Plantronics Blackwire 5220 Series::Headphones",
		"_input": "Plantronics Blackwire 5220 Series::Headset Microphone"
	}
};


class SimpleSoundApplet extends MultiIconApplet {


	constructor(orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId);
		this.set_applet_icon_symbolic_name('_input','audio-input-microphone-symbolic');
		this.set_applet_icon_symbolic_name('_output','audio-headset-symbolic');
		this.set_applet_tooltip("Switches between devices");
		this.mute_switch = [];
		this.mute_id = [];
		this.device = [];
		this.volume_selection = [];
		this.devices = {
			"_output": [],
			"_input": []
		};

		this.setupControls();
		this.drawMenu(orientation);
	}

	drawMenu(orientation) {
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);

		this.mute_switch['_output'] = new PopupMenu.PopupSwitchIconMenuItem(_("Mute output"), false, "audio-headset-symbolic", St.IconType.SYMBOLIC);
		this.mute_switch['_input'] = new PopupMenu.PopupSwitchIconMenuItem(_("Mute input"), false, "audio-input-microphone-symbolic", St.IconType.SYMBOLIC);
		this.mute_switch['_output'].connect('toggled', () => this._toggle_mute('_output'));
		this.mute_switch['_input'].connect('toggled', () => this._toggle_mute('_input'));

		this.menu.addMenuItem(this.mute_switch['_output']);
		this.menu.addMenuItem(this.mute_switch['_input']);
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


		this.volume_selection['_output'] = new VolumeSlider(this, this._control.get_default_sink(), _("Volume"), 'audio-headset-symbolic');
		this.volume_selection['_input'] = new VolumeSlider(this, this._control.get_default_source(), _("Microphone"), 'audio-input-microphone-symbolic');

		// this.volume_selection['_output'].connect("values-changed", (...args) => this._inputValuesChanged(...args));
		// this.volume_selection['_input'].connect("values-changed", (...args) => this._outputValuesChanged(...args));

		// this._inputVolumeSection.connect("values-changed", (...args) => this._inputValuesChanged(...args));
		// this._outputVolumeSection.connect("values-changed", (...args) => this._outputValuesChanged(...args));

		this.menu.addMenuItem(this.volume_selection['_input']);
		this.menu.addMenuItem(this.volume_selection['_output']);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addSettingsAction(_("Sound Settings"), 'sound');
		this.menu.addSettingsAction(_("PA Settings"), 'pavucontrol.desktop');

		
	}

	setupControls() {
		Main.keybindingManager.addHotKey("sound-open-" + this.instance_id, this.keyOpen, Lang.bind(this, this.on_applet_clicked));
		this._control = new Cvc.MixerControl({ name: 'Cinnamon Volume Control' });
		this._sound_settings = new Gio.Settings({ schema_id: CINNAMON_DESKTOP_SOUNDS });
		this._control.open();

		this._volumeMax = this._sound_settings.get_int(MAXIMUM_VOLUME_KEY) / 100 * this._control.get_vol_max_norm();
		this._volumeNorm = this._control.get_vol_max_norm();


		this._control.connect('output-added', (...args) => this._onDeviceAdded(...args, "_output"));
		this._control.connect('input-added', (...args) => this._onDeviceAdded(...args, "_input"));


		this._control.connect('state-changed', (...args) => this._onControlStateChanged(...args));
		this._control.connect('active-output-update', (...args) => this._onDeviceUpdate(...args, "_output"));
		this._control.connect('active-input-update', (...args) => this._onDeviceUpdate(...args, "_input"));


		this.actor.connect('scroll-event', (...args) => this._onScrollEvent(...args));
		// this.actor.connect('key-press-event', (...args) => this._onKeyPressEvent(...args));


	}

// 	_valuesChanged(type) {
// 		this.mute_switch[type]
// 		this.mute_in_switch.setIconSymbolicName(iconName);
// 	}

// 	_outputValuesChanged(actor, iconName, percentage) {
// 		this.setIcon(iconName, "output");
// 		this.mute_out_switch.setIconSymbolicName(iconName);
// 		this.set_applet_tooltip(_("Volume") + ": " + percentage);

// 		if (this.defaultColor === null) {
// 				//this.actor.set_style("applet-box");
// 				let themeNode = this.actor.get_theme_node();
// 				this.defaultColor = themeNode.get_foreground_color();
// 		}
// 		let color = "rgba("+this.defaultColor.red+","+this.defaultColor.green+","+this.defaultColor.blue+","+this.defaultColor.alpha+")";

// 		if (this.adaptColor) {
// 				let pc = Math.round(percentage.split("%")[0]);
// 				if (pc > 130)
// 						color = "red";
// 				else if (pc > 115)
// 						color = "orange";
// 				else if (pc > 100)
// 						color = "yellow";
// 		}
// 		let _style = "color: %s;".format(color);
// 		this.actor.style = _style;
// 		this._outputVolumeSection.icon.style = _style;
// 		this._outputVolumeSection.style = _style;
// }

// _inputValuesChanged(actor, iconName) {
// 		this.mute_in_switch.setIconSymbolicName(iconName);
// }



	// _set_default_device(device) {
	// 	let output = device['_output'];
	// 	let input = device['_input'];
	// 	global.log(`changing default output to: ${output}`);
	// 	global.log(`changing default input to: ${input}`);


	// 	let sink = this.devices['_output'][output];
	// 	let source = this.devices['_input'][input];
	// 	global.log(`changing default to: ${sink.description} and ${source.description}`);
	// 	this._control.set_default_sink(sink);
	// 	global.log("1");
	// 	this._control.set_default_source(source);
	// 	global.log("2");
	// }

	_onScrollEvent(actor, event) {
		let direction = event.get_scroll_direction();
		let currentVolume = this.device['_output'].volume;
		global.log(`_onScrollEvent:: ${direction}`);

		if (direction == Clutter.ScrollDirection.DOWN) {
			global.log(`_onScrollEvent:: down`);
			let prev_muted = this.device['_output'].is_muted;
				this.device['_output'].volume = Math.max(0, currentVolume - this._volumeNorm * VOLUME_ADJUSTMENT_STEP);
				if (this.device['_output'].volume < 1) {
						this.device['_output'].volume = 0;
						if (!prev_muted)
								this.device['_output'].change_is_muted(true);
				} else {
						// 100% is magnetic:
						if (this.magneticOn === true && this.device['_output'].volume!=this._volumeNorm && this.device['_output'].volume>this._volumeNorm*(1-VOLUME_ADJUSTMENT_STEP/2) && this.device['_output'].volume<this._volumeNorm*(1+VOLUME_ADJUSTMENT_STEP/2))
								this.device['_output'].volume=this._volumeNorm;
				}
				this.device['_output'].push_volume();
		}
		else if (direction == Clutter.ScrollDirection.UP) {
			global.log(`_onScrollEvent:: uo`);
				this.device['_output'].volume = Math.min(this._volumeMax, currentVolume + this._volumeNorm * VOLUME_ADJUSTMENT_STEP);
				// 100% is magnetic:
				if (this.magneticOn === true && this.device['_output'].volume!=this._volumeNorm && this.device['_output'].volume>this._volumeNorm*(1-VOLUME_ADJUSTMENT_STEP/2) && this.device['_output'].volume<this._volumeNorm*(1+VOLUME_ADJUSTMENT_STEP/2))
						this.device['_output'].volume=this._volumeNorm;
				this.device['_output'].push_volume();
				this.device['_output'].change_is_muted(false);
		}
		// this._notifyVolumeChange(this.device['_output']);
		let percentage = ((this.device['_output'].volume/this._volumeNorm).toFixed(2)*100).toFixed(0);
		this.set_applet_tooltip(_("Volume") + ": " + percentage + "%");
	}	

	_onButtonPressEvent (actor, event) {
		switch (event.get_button())  {
			case 9:
				this._set_default_device(setup.HEADSET);
				break;
			;;

			case 8:
				this._set_default_device(setup.SPEAKERS);
				break;
			;;

			case 2:
				this._toggle_mute('_input');
				break;
				// trocar device
			;;

			default:
				return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
			
		}
		return Clutter.EVENT_STOP;
	}

	_toggle_mute(property) {
		if (!this.device[property])
				return;
		this.device[property].change_is_muted(
			!this.device[property].is_muted
		);
		this.mute_switch[property].setToggleState(this.device[property].is_muted);
	}

	_onDeviceAdded(control, id, type) {
		let device = this._control[`lookup${type}_id`](id);
		let full_name = `${device.origin}::${device.description}`;
		this.devices[type][full_name] = device;
		// global.logError(`_onDeviceAdded:: (${type}) ${full_name} ${this.devices[type][full_name]}`);
	}


	_onDeviceUpdate(control, id, type) {
		let device = this._control[`lookup${type}_id`](id);
		let stream =  this._control.get_stream_from_device(device);
		// global.logError(`_onDeviceUpdate:: (${type}) ${device.origin}:: ${device.description}`);

		let icon = 
			(device.origin == 'Plantronics Blackwire 5220 Series') ?
			"audio-headset-symbolic":
			"audio-speakers-symbolic"
		;
		this.set_applet_icon_symbolic_name('_output', icon);
		this.mute_switch['_output'].setIconSymbolicName(icon);
		this.volume_selection[type].connectWithStream(stream);
	}

	_onControlStateChanged() {
		// global.log('_onControlStateChanged::');
		if (this._control.get_state() == Cvc.MixerControlState.READY) {
				this._read('_output');
				this._read('_input');
				let percentage = ((this.device['_output'].volume/this._volumeNorm).toFixed(2)*100).toFixed(0);
				this.set_applet_tooltip(_("Volume") + ": " + percentage + "%");
				this.actor.show();
		} else {
			this.actor.hide();
		}
	}

	_read(property) {
		// disconnects existing listener
		if (this.mute_id[property]) {
			this.device[property].disconnect(this.mute_id[property]);
			this.mute_id[property] = 0;
		}

		this.device[property] = 
			(property == '_input') ?
			this._control.get_default_source():
			this._control.get_default_sink()
		;

		if (this.device[property]) {
			// this._inputVolumeSection.connectWithStream(this.device['_input']);
			this.mute_id[property] = this.device[property].connect('notify::is-muted', (...args) => this._mutedChanged(...args, property));
			this._mutedChanged (null, null, property);
		}
	}

	_mutedChanged(object, param_spec, property) {
		this.mute_switch[property].setToggleState(this.device[property].is_muted);
		let defaultColor = this.actor.get_theme_node().get_foreground_color();
		this._applet_icons[property].style = 
			this.device[property].is_muted ?
			"color: red;":
			"color: (%s,%s,%s,%s);".format(
				defaultColor.red,
				defaultColor.green,
				defaultColor.blue,
				defaultColor.alpha
			)
		;
	}

	on_applet_clicked(event) {
		this.menu.toggle();
	}

}

function main(metadata, orientation, panelHeight, instanceId) {
	return new SimpleSoundApplet(orientation, panelHeight, instanceId);
}


