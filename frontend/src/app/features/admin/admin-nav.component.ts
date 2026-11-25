import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type AdminNavTab = 'monitoring' | 'verifikasi' | 'anggota' | 'tambah-anggota';

@Component({
  selector: 'app-admin-nav',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <nav class="admin-nav" aria-label="Navigasi pengurus">
      <a
        routerLink="/admin-monitoring"
        [class.is-current]="active === 'monitoring'"
        [attr.aria-current]="active === 'monitoring' ? 'page' : null"
      >Monitoring</a>
      <a
        routerLink="/admin-verifikasi"
        [class.is-current]="active === 'verifikasi'"
        [attr.aria-current]="active === 'verifikasi' ? 'page' : null"
      >Verifikasi</a>
      <a
        routerLink="/admin-anggota"
        [class.is-current]="active === 'anggota'"
        [attr.aria-current]="active === 'anggota' ? 'page' : null"
      >Anggota</a>
      <a
        routerLink="/admin-tambah-anggota"
        [class.is-current]="active === 'tambah-anggota'"
        [attr.aria-current]="active === 'tambah-anggota' ? 'page' : null"
      >Tambah anggota</a>
    </nav>
  `
})
export class AdminNavComponent {
  @Input() active: AdminNavTab = 'monitoring';
}
