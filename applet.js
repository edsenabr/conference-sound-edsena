const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const {VolumeSlider} = require('./VolumeSlider');
const {MultiIconApplet} = require('./MultiIconApplet');
const {MediaPlayerController} = require('./MediaPlayerController');
const {SignalManager} = imports.misc.signalManager;
const {AudioController} = require('./AudioController');
const {LogUtils} = require(`./LogUtils`)
const LOG = new LogUtils(LogUtils.levels.Info, 'SimpleSoundApplet');
const MK = imports.gi.CDesktopEnums.MediaKeyType;
const XF86AudioMicMute = `media-keys-${MK.MIC_MUTE}`;
const XF86AudioLowerVolume = `media-keys-${MK.VOLUME_DOWN}`;
const XF86AudioRaiseVolume = `media-keys-${MK.VOLUME_UP}`;
const {MediaPlayerMenuItem} = require('./MediaPlayerMenuItem');
const Extension = imports.ui.extension;
const UUID = "conference-sound-edsena";

class SimpleSoundApplet extends MultiIconApplet {
	HEADSET_NOT_AVAILABLE_ICON = Gio.Icon.new_for_string(Extension.getExtension(UUID).dir.get_child("audio-headset-not-available-symbolic.svg").get_path());

	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId, ['source', 'sink']);
		this._metadata = metadata;
		this.set_applet_icon_symbolic_name('source','audio-input-microphone-symbolic');
		this.set_applet_icon_symbolic_name('sink','audio-headset-symbolic');
		this._mute_switches = {};
		this._volume_sliders = {};
		this._signalManager = new SignalManager(null);
		this._radio_buttons = {};

		this._controller = new AudioController();

		this._drawMenu(orientation);

		this._global_keybindings = this._setKeybindings();

		this._devices = new Map();
		this._mediaController = new MediaPlayerController();
		this._setupListeners();
	}

	/** applet methods */


	_drawMenu(orientation) {
		// controles
		this._mute_switches['sink'] = new PopupMenu.PopupSwitchIconMenuItem(_("Mute output"), false, "audio-headset-symbolic", St.IconType.SYMBOLIC);
		this._mute_switches['source'] = new PopupMenu.PopupSwitchIconMenuItem(_("Mute input"), false, "audio-input-microphone-symbolic", St.IconType.SYMBOLIC);
		this._volume_sliders['sink'] = new VolumeSlider(true, _("Volume"), 'audio-headset-symbolic', 'sink');
		this._volume_sliders['source'] = new VolumeSlider(true, _("Microphone"), 'audio-input-microphone-symbolic', 'source');

		// menu
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);

        this._chooseActivePlayerItem = new PopupMenu.PopupSubMenuMenuItem(_("Choose player controls"));
		this._chooseActivePlayerItem.menu.close = () => {}
		this._chooseActivePlayerItem.actor.hide();

        this.menu.addMenuItem(this._chooseActivePlayerItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// botoes de mute
		this.menu.addMenuItem(this._mute_switches['source']);
		this.menu.addMenuItem(this._mute_switches['sink']);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		this.menu.addMenuItem(this._drawDeviceSelection("Headset"));
		this.menu.addMenuItem(this._drawDeviceSelection("Speakers"));

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// deslizantes de volume
		this.menu.addMenuItem(this._volume_sliders['source']);
		this.menu.addMenuItem(this._volume_sliders['sink']);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// ajustes
		this.menu.addSettingsAction(_("Sound Settings"), 'sound');
		this.menu.addCommandlineAction(_("Pulse Audio Settings"), 'pavucontrol');

	}

	_drawDeviceSelection(type){
		let device = new PopupMenu.PopupMenuItem(type);
		let bin = new St.Bin({ x_align: St.Align.END, style_class: 'popup-active-menu-item' });
		device.addActor(bin, { expand: false, span: -1, align: St.Align.END });
		device.activate = () => this._controller.toggle_setup(type);
		this._radio_buttons[type] = device;
		return device;
	}

	_setupListeners() {
		for (let name in this._mute_switches){
			let item =  this._mute_switches[name];
			this._signalManager.connect(item, 'toggled', this._controller.toggle_mute.bind(this._controller, name));
		};

		for (let name in this._volume_sliders) {
			let item = this._volume_sliders[name];
			this._signalManager.connect(item, 'toggle-mute', this._controller.toggle_mute.bind(this._controller, name));
			
			this._signalManager.connect(item, 'volume-slide', this._controller.change_volume, this._controller);
			this._signalManager.connect(this._controller, `change-volume-${name}`, item.update, item);
			
		};

		this._signalManager.connect(this._controller, 'status-update',this._updateTooltip, this);
		this._signalManager.connect(this.actor, 'scroll-event', this._onScrollEvent, this);
		this._signalManager.connect(this._controller, 'default-changed', this._setDefaultDevice, this, true);
		this._signalManager.connect(this._controller, 'control-state-changed', this._onAudioControllerStateChanged, this, true);
		this._signalManager.connect(this._controller, 'change-mute', this._onMutedChanged, this, true);
		this._signalManager.connect(this._controller, 'change-failed', Main.osdWindowManager.show.bind(Main.osdWindowManager, -1, this.HEADSET_NOT_AVAILABLE_ICON, undefined));
		

		// media controller integration
		this._signalManager.connect(this._mediaController, 'player-changed', this._onPlayerChanged, this);
		this._signalManager.connect(this._mediaController, 'player-opened', this._onPlayerOpened, this);
		this._signalManager.connect(this._mediaController, 'player-closed', this._onPlayerClosed, this);
		LOG.done();
	}

	_setKeybindings() {
		Main.keybindingManager.addHotKey("use-headset-" + this.instance_id, "<Super>h", this._controller.toggle_setup.bind(this._controller, "Headset"));
		Main.keybindingManager.addHotKey("use-speakers-" + this.instance_id, "<Super>s", this._controller.toggle_setup.bind(this._controller, "Speakers"));

		let keybindings = new Map ([
			[XF86AudioMicMute, undefined],
			[XF86AudioLowerVolume, undefined],
			[XF86AudioRaiseVolume, undefined]
		]);		
		Main.keybindingManager.bindings.forEach((value, key) => {
			if (keybindings.has(value.name)) {
				keybindings.set(value.name, key);
			}
		})
		return keybindings;
	}

	on_applet_removed_from_panel () {
		this._signalManager.disconnectAllSignals();
		this.menu.destroy();
		this._mediaController.destroy();
		this._controller.destroy();
	}

	on_applet_clicked(event) {
		this.menu.toggle();
	}

	/** AudioController methods  */

	_updateTooltip(controller, status) {
		let source = Math.round(status.source.percentage / status.source.mark * 100) + "%";
		let sink = Math.round(status.sink.percentage / status.sink.mark * 100) + "%";
		this.set_applet_tooltip(
			_("Microphone") + ": " + source + "\n" + 
			_("Volume") + ": " + sink
		);
	}
	
	_onButtonPressEvent (actor, event) {
		if (event.get_button() == 2) {
			Main.keybindingManager.invoke_keybinding_action_by_id(this._global_keybindings.get(XF86AudioMicMute));
			return Clutter.EVENT_STOP;
		}
		return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
	}

	_onAudioControllerStateChanged(controller, online) {
		LOG.init(online);
		if (online) {
			this.actor.show();
		} else {
			this.actor.hide();
		}
	}

	_onMutedChanged(controller, direction, muted) {
		this._mute_switches[direction].setToggleState(muted); // adjust, refactor into controller method
		let defaultColor = this.actor.get_theme_node().get_foreground_color();
		let style = 
			muted ?
			"color: red;":
			"color: (%s,%s,%s,%s);".format(
				defaultColor.red,
				defaultColor.green,
				defaultColor.blue,
				defaultColor.alpha
			)
		;

		this._applet_icons[direction].style = style;
		this._volume_sliders[direction].icon.style = style;

	}

	_onScrollEvent(actor, event) {
		const direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.SMOOTH) {
            return Clutter.EVENT_PROPAGATE;
        }
		let key = (event.get_scroll_direction() == Clutter.ScrollDirection.UP) ? XF86AudioRaiseVolume: XF86AudioLowerVolume;
		Main.keybindingManager.invoke_keybinding_action_by_id(this._global_keybindings.get(key));
	}

	_updateUi(type) {
		let icon = '';
		let active = null;
		let inactive = null;
		if (type == "Headset") {
			icon = "audio-headset-symbolic";
			active  = this._radio_buttons["Headset"];
			inactive = this._radio_buttons["Speakers"];
		} else {
			icon = "audio-speakers-symbolic";
			active  = this._radio_buttons["Speakers"];
			inactive = this._radio_buttons["Headset"];
		}

		active.setShowDot(true);
		inactive.setShowDot(false);
		Main.osdWindowManager.show(-1, Gio.Icon.new_for_string(icon), undefined);
		this.set_applet_icon_symbolic_name('sink', icon);
		this._mute_switches['sink'].setIconSymbolicName(icon);
		this._volume_sliders['sink'].icon.set_icon_name(icon);
	}

	_setDefaultDevice(emmitter, type){
		this._updateUi(type);
	}

	/** media controller relad methods */
	_onPlayerOpened(emitter, name){
		LOG.init(`opened player ${name}`);
		let device = new MediaPlayerMenuItem(name);
		this._signalManager.connect(device, 'change-player', this._onChangePlayer, this);
		this._devices.set(name, device);
		this._chooseActivePlayerItem.menu.addMenuItem(device);
		this._chooseActivePlayerItem.actor.show();
		this._chooseActivePlayerItem.menu.open();
		LOG.done();
	}

	_onPlayerClosed(emitter, name){
		LOG.init(`closed player ${name}`);
		let device = this._devices.get(name);
		if (!device) {
			return;
		}
		this._signalManager.disconnect('change-player', device, this._onChangePlayer);
		this._devices.delete(name)
		if (this._devices.size == 0) {
			this._chooseActivePlayerItem.actor.hide();
		}
		device.destroy();
		LOG.done();
	}


	_onChangePlayer(emmiter, name) {
		LOG.init(`change player to ${name}`);
		this._mediaController._changeActivePlayer(name);
		LOG.done();
	}

	_onPlayerChanged(emitter, active) {
		LOG.init(`changed player to ${active}`);
		this._devices.forEach((device, name) => {
			device.setShowDot(name == active)
		})
		LOG.done();
	}	

}

function main(metadata, orientation, panelHeight, instanceId) {
	return new SimpleSoundApplet(metadata, orientation, panelHeight, instanceId);
}