import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, Router, ActivatedRoute, RouteReuseStrategy, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, NgModel, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { RifaService } from '../../../service/rifa.service';
import { SorteoStateService, Resultado } from '../../../service/sorteo-state.service';
import { Subscription } from 'rxjs';

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
export class HomeComponent implements OnInit, OnDestroy {

  public _rifa = inject(RifaService);
  public sorteoState = inject(SorteoStateService);
  
  formRifa: any;
  resultadoActual: Resultado | null = null;
  historialGanadores: Resultado[] = [];
  tipo: number = 0;
  mostrandoResultado: boolean = false;
  cargandoSorteo: boolean = false;

  // Subscripciones para limpiar en OnDestroy
  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router, 
    private modelService: NgbModal,
    private fb: FormBuilder,
    private aRouter: ActivatedRoute,
  ) {
    this.formRifa = this.fb.group({
      busqueda: [''],
    });
  }

  ngOnInit() {
    // Obtener el parámetro tipo
    this.aRouter.paramMap.subscribe(params => {
      const tipo = params.get('tipo');  
      this.tipo = Number(tipo);
      console.log("Parámetro recibido - tipo:", this.tipo);
    });

    // Suscribirse a los cambios de estado del servicio
    const resultadoSub = this.sorteoState.resultadoActual$.subscribe(resultado => {
      console.log('Componente recibió nuevo resultado:', resultado);
      this.resultadoActual = resultado;
    });

    const mostrandoSub = this.sorteoState.mostrandoResultado$.subscribe(mostrando => {
      console.log('Componente recibió nuevo mostrandoResultado:', mostrando);
      this.mostrandoResultado = mostrando;
    });

    const historialSub = this.sorteoState.historial$.subscribe(historial => {
      console.log('Componente recibió nuevo historial:', historial);
      this.historialGanadores = historial;
    });

    this.subscriptions.push(resultadoSub, mostrandoSub, historialSub);
  }

  ngOnDestroy() {
    // Limpiar subscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Método para manejar errores de imagen
  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    
    if (!imgElement.src.includes('default.jpg') && !imgElement.src.includes('placeholder')) {
      console.log('Error cargando imagen:', imgElement.src);
      imgElement.src = 'https://via.placeholder.com/400x400.png?text=Premio';
    }
  }

  sorteo() {
    if (this.cargandoSorteo) return;
    
    console.log('=== INICIO SORTEO ===');
    console.log('Tipo actual:', this.tipo);
    
    this.cargandoSorteo = true;
    this.sorteoState.setMostrandoResultado(false);
    
    this._rifa.numRadom().subscribe({
      next: (response: any) => {
        console.log('=== RESPUESTA RECIBIDA ===');
        console.log('Response completo:', response);
        
        const resultado = response as Resultado;
        
        // Actualizar el estado en el servicio compartido
        this.sorteoState.setResultado(resultado);
        this.sorteoState.agregarAlHistorial(resultado);
        
        // Mostrar resultado después de un momento
        setTimeout(() => {
          this.sorteoState.setMostrandoResultado(true);
          this.cargandoSorteo = false;
          console.log('===ESTADO RESULTADO==: ' ,this.mostrandoResultado);
          console.log('Estado actualizado en servicio compartido');
          console.log('=== FIN SORTEO ===');
          
          if (this.tipo === 1) {
            Swal.fire({
              icon: 'success',
              title: '¡Sorteo realizado!',
              text: `Premio: ${resultado.premio}`,
              timer: 2000,
              showConfirmButton: false
            });
          }
        }, 1000);
      },
      error: (e: HttpErrorResponse) => {
        console.error('=== ERROR EN SORTEO ===', e);
        this.cargandoSorteo = false;
        
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo realizar el sorteo'
        });
      }
    });
  }

  limpiarResultado() {
    Swal.fire({
      title: '¿Limpiar resultado?',
      text: "Se ocultará el resultado actual de la pantalla pública",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.sorteoState.limpiarResultado();
        console.log('Resultado limpiado en servicio compartido');
        
        Swal.fire({
          icon: 'success',
          title: 'Limpiado',
          text: 'La pantalla pública está lista para el próximo sorteo',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  }

  limpiarHistorial() {
    Swal.fire({
      title: '¿Limpiar historial completo?',
      text: "Esta acción no se puede deshacer",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, limpiar todo',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.sorteoState.limpiarHistorial();
        
        Swal.fire({
          icon: 'success',
          title: 'Historial limpiado',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  }
}