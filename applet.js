const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Cvc = imports.gi.Cvc;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Util = imports.misc.util;
const {VolumeSlider} = require('./VolumeSlider');
const {MultiIconApplet} = require('./MultiIconApplet');


const CINNAMON_DESKTOP_SOUNDS = "org.cinnamon.desktop.sound";
const MAXIMUM_VOLUME_KEY = "maximum-volume";
const VOLUME_ADJUSTMENT_STEP = 0.04; /* Volume adjustment step in % */
const setup = {
	SPEAKERS: {
		"_output": "::Auto-Falantes com echo-canceling",
		"_input": "::Boya BY-MM1",
		"name": "Speakers",
		"label": "Auto-Falantes + Boya BY-MM1",
		"icon": "audio-headset-symbolic"
	},
	HEADSET: {
		"_output": "Plantronics Blackwire 5220 Series::Headphones",
		"_input": "Plantronics Blackwire 5220 Series::Headset Microphone",
		"name": "Headset",
		"label": "Plantronics Blackwire 5220 Series",
		"icon": "audio-speakers-symbolic"
	},
	lookup: function (device, type) {
		let full_name = `${device.origin}::${device.description}`;
		switch (full_name){
			case this.HEADSET[type]:
				return this.HEADSET;
			;;
			case this.SPEAKERS[type]:
				return this.SPEAKERS;
			;;
			default:
				return undefined;
		}
	},
	update: function (full_name, user_data) {
		user_data.setup[user_data.type] = full_name
	}
};



class SimpleSoundApplet extends MultiIconApplet {
	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId, ['_input', '_output']);
		this.metadata = metadata;
		this.set_applet_icon_symbolic_name('_input','audio-input-microphone-symbolic');
		this.set_applet_icon_symbolic_name('_output','audio-headset-symbolic');
		this.mute_switch = [];
		this.mute_id = [];
		this.stream = [];
		this.volume_selection = [];
		this.devices = {
			"_output": [],
			"_input": []
		};

		this.setupMixerControls();
		this.drawMenu(orientation);
		this.setupListeners();

		this._setKeybinding();
		this.setupConfiguration();
	}

	setupConfiguration () {
		this.settings = new Settings.AppletSettings(this, this.metadata.uuid, this.instanceId);
		this.settings.bind("headset_input", "headset_input", setup.update, {type: '_input', setup: setup.HEADSET});
		this.settings.bind("headset_output", "headset_output", setup.update, {type: '_output', setup: setup.HEADSET});
		this.settings.bind("speakers_input", "speakers_input", setup.update, {type: '_input', setup: setup.SPEAKERS});
		this.settings.bind("speakers_output", "speakers_output", setup.update, {type: '_output', setup: setup.SPEAKERS});
	}

	drawMenu(orientation) {
		// controles
		this.mute_switch['_output'] = new PopupMenu.PopupSwitchIconMenuItem(_("Mute output"), false, "audio-headset-symbolic", St.IconType.SYMBOLIC);
		this.mute_switch['_input'] = new PopupMenu.PopupSwitchIconMenuItem(_("Mute input"), false, "audio-input-microphone-symbolic", St.IconType.SYMBOLIC);
		this.volume_selection['_output'] = new VolumeSlider(true, this._volumeMax, this._volumeNorm, _("Volume"), 'audio-headset-symbolic');
		this.volume_selection['_input'] = new VolumeSlider(true, this._volumeMax, this._volumeNorm, _("Microphone"), 'audio-input-microphone-symbolic');

		// menu
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);

		// botoes de mute
		this.menu.addMenuItem(this.mute_switch['_input']);
		this.menu.addMenuItem(this.mute_switch['_output']);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		this.menu.addMenuItem(this._drawDevice(setup.HEADSET));
		this.menu.addMenuItem(this._drawDevice(setup.SPEAKERS));

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// deslizantes de volume
		this.menu.addMenuItem(this.volume_selection['_input']);
		this.menu.addMenuItem(this.volume_selection['_output']);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// ajustes
		this.menu.addSettingsAction(_("Sound Settings"), 'sound');
		this.menu.addCommandlineAction(_("Pulse Audio Settings"), 'pavucontrol');

	}

	_drawDevice(setup){
		let device = new PopupMenu.PopupMenuItem(setup.name);
		let bin = new St.Bin({ x_align: St.Align.END, style_class: 'popup-active-menu-item' });
		device.addActor(bin, { expand: false, span: -1, align: St.Align.END });
		device.activate = () => this._toggle_setup(setup);
		setup.control = device;
		return device;
	}

	_toggle_setup(setup) {
		global.log(`_toggle_setup:: ${setup.name}`);
		this._control.change_input(this.devices['_input'][setup['_input']]);
		this._control.change_output(this.devices['_output'][setup['_output']]);
	}

	setupMixerControls() {
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
	}

	setupListeners() {
		this.mute_switch['_output'].connect('toggled', () => this._toggle_mute('_output'));
		this.mute_switch['_input'].connect('toggled', () => this._toggle_mute('_input'));
		this.volume_selection['_output'].connect("volume-changed", (...args) => this._updateTooltip(...args));
		this.volume_selection['_input'].connect("toggle-mute", () => this._toggle_mute('_input'));
		this.volume_selection['_output'].connect("toggle-mute", () => this._toggle_mute('_output'));
		this.actor.connect('scroll-event', (...args) => this.volume_selection['_output']._onScrollEvent(...args));
	}

	_setKeybinding() {
		// Main.keybindingManager.addHotKey("toggle-mute-" + this.instance_id, "Pause", Lang.bind(this, () => this._toggle_mute('_input')));
		Main.keybindingManager.addHotKey("use-headset-" + this.instance_id, "<Super>h", Lang.bind(this, () => this._toggle_setup(setup.HEADSET)));
		Main.keybindingManager.addHotKey("use-speakers-" + this.instance_id, "<Super>s", Lang.bind(this, () => this._toggle_setup(setup.SPEAKERS)));
	}

	on_applet_removed_from_panel () {
		Main.keybindingManager.removeHotKey("toggle-mute-" + this.instance_id);
		Main.keybindingManager.removeHotKey("use-headset-" + this.instance_id);
		Main.keybindingManager.removeHotKey("use-speakers-" + this.instance_id);
	}


	_updateTooltip(actor, percentage) {
		this.set_applet_tooltip(_("Volume") + ": " + percentage);
	}
	
	_onButtonPressEvent (actor, event) {
		if (event.get_button() == 2) {
			this._toggle_mute('_input');
			return Clutter.EVENT_STOP;
		}
		return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
	}

	_toggle_mute(property) {
		global.log(`_toggle_mute:: ${property}`)
		if (!this.stream[property])
				return;

		this.stream[property].change_is_muted(
			!this.stream[property].is_muted
		);
		this.mute_switch[property].setToggleState(this.stream[property].is_muted);
		global.log(`_toggle_mute:: done`)
	}

	_onDeviceAdded(control, id, type) {
		let device = this._control[`lookup${type}_id`](id);
		let full_name = `${device.origin}::${device.description}`;
		this.devices[type][full_name] = device;
		let options = this.generateSettingsOptions(type);
		this.settings.setOptions(`headset${type}`, options);
		this.settings.setOptions(`speakers${type}`, options);
		global.log(`_onDeviceAddedd::id=${id}, card=${device.get_card().get_name()} =>${full_name}`);
	}

	generateSettingsOptions(type) {
		let options = {};
		for (let device in this.devices[type]) {
			options[device] = device;
		}
		return options;
	}

	_onDeviceUpdate(control, id, type) {
		let device = this._control[`lookup${type}_id`](id);
		let stream =  this._control.get_stream_from_device(device);
		let full_name = `${device.origin}::${device.description}`;

		if (this.mute_id[type]) {
			this.stream[type].disconnect(this.mute_id[type]);
			this.mute_id[type] = 0;
		}
		this.stream[type] = stream;

		global.log(`_onDeviceUpdate:: id=${id}, card=${device.port_name} => ${full_name} is muted ? ${stream.is_muted}`);
		this.mute_id[type] = stream.connect('notify::is-muted', () => this._onMutedChanged(type));
		
		let icon = '';
		let active = null;
		let inactive = null;
		if (full_name == setup.HEADSET._output) {
			icon = "audio-headset-symbolic";
			active  = setup.HEADSET.control;
			inactive = setup.SPEAKERS.control;
		} else {
			icon = "audio-speakers-symbolic";
			active  = setup.SPEAKERS.control;
			inactive = setup.HEADSET.control;
		}

		active.setShowDot(true);
		inactive.setShowDot(false);
		Main.osdWindowManager.show(-1, Gio.Icon.new_for_string(icon), undefined);
		this.set_applet_icon_symbolic_name('_output', icon);
		this.mute_switch['_output'].setIconSymbolicName(icon);
		this.volume_selection['_output'].icon.set_icon_name(icon);
		this.volume_selection[type].connectWithStream(stream);
		this._onMutedChanged (type);
	}

	_onControlStateChanged() {
		if (this._control.get_state() == Cvc.MixerControlState.READY) {
				this.actor.show();
		} else {
			this.actor.hide();
		}
	}

	_onMutedChanged(property) {

		this.mute_switch[property].setToggleState(this.stream[property].is_muted);
		let defaultColor = this.actor.get_theme_node().get_foreground_color();
		let style = 
			this.stream[property].is_muted ?
			"color: red;":
			"color: (%s,%s,%s,%s);".format(
				defaultColor.red,
				defaultColor.green,
				defaultColor.blue,
				defaultColor.alpha
			)
		;

		this._applet_icons[property].style = style;
		this.volume_selection[property].icon.style = style;

	}

	on_applet_clicked(event) {
		this.menu.toggle();
	}

}

function main(metadata, orientation, panelHeight, instanceId) {
	return new SimpleSoundApplet(metadata, orientation, panelHeight, instanceId);
}