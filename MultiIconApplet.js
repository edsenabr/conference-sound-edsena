const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const St = imports.gi.St;

function log(message) {
	// global.logError(error);
}

function error(message) {
	
}

function debug(message) {

}

class MultiIconApplet extends imports.ui.applet.Applet {
	constructor(orientation, panel_height, instance_id, icons) {
			super(orientation, panel_height, instance_id);
			log('constructor::init');
			this._applet_icon_boxes = new Array(icons.lengh);   //array of containers
			this._applet_icons = new Array(icons.lengh);        //array of icons
			icons.forEach(icon => {
				this._applet_icon_boxes[icon] = this._init_icon_box();
			});
			log('constructor::done');
	}

	_init_icon_box() {
		log('_init_icon_box::init');
		const box = new St.Bin();
		box.set_fill(true,true);
		box.set_alignment(St.Align.MIDDLE,St.Align.MIDDLE);
		this.actor.add(box);		
		log('_init_icon_box::done');
		return box;
	}

	_ensureIcon(name) {
		log(`_ensureIcon::init for -> ${name}`);
		if (!this._applet_icons[name] ||
				!(this._applet_icons[name] instanceof St.Icon))
				this._applet_icons[name] = new St.Icon({
						reactive: true, track_hover: true,
						style_class: 'applet-icon'
				});
		this._applet_icon_boxes[name].set_child(this._applet_icons[name]);
		log('_ensureIcon::done');
		return this._applet_icons[name];
	}

	set_applet_icon_name (name, icon_name) {
			let icon = this._ensureIcon(name);
			icon.set_icon_name(icon_name);
			icon.set_icon_type(St.IconType.FULLCOLOR);
			this._setStyle(icon);
	}

	set_applet_icon_symbolic_name (name, icon_name) {
		log(`set_applet_icon_symbolic_name::init for -> ${name}`);
		let icon = this._ensureIcon(name);
		icon.set_icon_name(icon_name);
		icon.set_icon_type(St.IconType.SYMBOLIC);
		this._setStyle(icon);
		log('set_applet_icon_symbolic_name::done');
	}

	set_applet_icon_path (name, icon_path) {
			let icon = this._ensureIcon(name);

			try {
					let file = Gio.file_new_for_path(icon_path);
					icon.set_gicon(new Gio.FileIcon({ file: file }));
					icon.set_icon_type(St.IconType.FULLCOLOR);
					this._setStyle(icon);
			} catch (e) {
					global.log(e);
			}
	}

	set_applet_icon_symbolic_path(name, icon_path) {
			let icon = this._ensureIcon(name);
			try {
					let file = Gio.file_new_for_path(icon_path);
					icon.set_gicon(new Gio.FileIcon({ file: file }));
					icon.set_icon_type(St.IconType.SYMBOLIC);
					this._setStyle(icon);
			} catch (e) {
					global.log(e);
			}
	}

	_setStyle(icon) {
			let icon_type = icon.get_icon_type();

			if (icon_type === St.IconType.FULLCOLOR) {
					icon.set_icon_size(this.getPanelIconSize(St.IconType.FULLCOLOR));
					icon.set_style_class_name('applet-icon');
			} else {
					icon.set_icon_size(this.getPanelIconSize(St.IconType.SYMBOLIC));
					icon.set_style_class_name('system-status-icon');
			}
	}

	on_panel_height_changed_internal() {
		this._applet_icons.forEach((icon) => {
			this._setStyle(icon);
		})
		this.on_panel_height_changed();
	}

	on_orientation_changed(neworientation) {
		this.orientation = neworientation;

		if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM)
				this.actor.set_vertical(false);
		else
				this.actor.set_vertical(true);
	}	
}

module.exports = {MultiIconApplet}