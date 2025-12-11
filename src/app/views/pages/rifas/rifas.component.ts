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
  selector: 'app-rifa',
  imports: [
     NgxDatatableModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule, 
    RouterModule
  ],
  templateUrl: './rifas.component.html',
  styleUrl: './rifas.component.scss'
})
export class RifasComponent {
  public _rifa = inject(RifaService);
 formRifa: any;
 resultados: any = {};
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

    sorteo(){
      console.log()
      this._rifa.numRadom().subscribe((resultados) => {
        this.resultados = resultados;
      });
    }

    reporte(){
        this._rifa.reporte().subscribe((pdfBlob: Blob) => {
        const url = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "reporte_rifa.pdf";
        a.click();
        window.URL.revokeObjectURL(url);
      });
    }
  }