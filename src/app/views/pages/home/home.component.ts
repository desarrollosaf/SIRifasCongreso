import { Component, inject } from '@angular/core';
import { RouterLink, Router, ActivatedRoute, RouteReuseStrategy, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, NgModel, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { RifaService } from '../../../service/rifa.service';

@Component({
  selector: 'app-home',
   imports: [
     NgxDatatableModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule, 
    RouterModule
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

  public _rifa = inject(RifaService);
  formRifa: any;
  resultados: any = {};
  tipo: number = 0;
  constructor(
      private router: Router, 
      private modelService: NgbModal,
      private fb: FormBuilder,
      private  aRouter: ActivatedRoute,
    ){
      this.formRifa = this.fb.group({
        busqueda: [''],
      });
  }

  ngOnInit() {
    this.aRouter.paramMap.subscribe(params => {
      const tipo = params.get('tipo');  
      this.tipo = Number(tipo);
      console.log("Parámetro recibido:", this.tipo);
    });
  }

  sorteo(){
    console.log()
    this._rifa.numRadom().subscribe((resultados) => {
      this.resultados = resultados;
      console.log(this.resultados)
    });
  }

}
