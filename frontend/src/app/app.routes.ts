import { Routes } from '@angular/router';
import { CatalogComponent } from './features/catalog/catalog.component';
import { ItemDetailComponent } from './features/catalog/item-detail.component';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { ItemCreateComponent } from './features/items/item-create.component';
import { StructureComponent } from './features/structure/structure.component';
import { AnnouncementsComponent } from './features/announcements/announcements.component';
import { ProfileComponent } from './features/profile/profile.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: CatalogComponent
  },
  {
    path: 'katalog/:id',
    component: ItemDetailComponent
  },
  {
    path: 'katalog',
    component: CatalogComponent
  },
  {
    path: 'struktur',
    component: StructureComponent,
    canActivate: [authGuard]
  },
  {
    path: 'pengumuman',
    component: AnnouncementsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'profil',
    component: ProfileComponent,
    canActivate: [authGuard]
  },
  {
    path: 'auth/login',
    component: LoginComponent
  },
  {
    path: 'auth/register',
    component: RegisterComponent
  },
  {
    path: 'barang/tambah',
    component: ItemCreateComponent,
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
