// En: src/Components/Common/CategoryManagerModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, 
    ListGroup, ListGroupItem, Spinner, 
    Pagination, PaginationItem, PaginationLink // <-- NUEVAS IMPORTACIONES PARA PAGINACIÓN
} from 'reactstrap';
import Swal from 'sweetalert2';

export interface Category {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  toggle: () => void;
  title: string;
  categories: Category[];
  onSave: (id: string, name: string) => Promise<any>; // Para actualizar
  onDelete: (id: string) => Promise<any>; // Para eliminar
}

const CategoryManagerModal: React.FC<Props> = ({ isOpen, toggle, title, categories, onSave, onDelete }) => {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(false);

  // --- NUEVO ESTADO PARA LA PÁGINA ACTUAL ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // --- LÓGICA PARA CALCULAR QUÉ CATEGORÍAS MOSTRAR ---
  const { paginatedCategories, totalPages } = useMemo(() => {
    const total = Math.ceil(categories.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return {
        paginatedCategories: categories.slice(startIndex, endIndex),
        totalPages: total > 0 ? total : 1
    };
  }, [categories, currentPage]);

  // --- EFECTO PARA AJUSTAR LA PÁGINA SI SE ELIMINAN ITEMS ---
  useEffect(() => {
    if (currentPage > totalPages) {
        setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);
  
  useEffect(() => {
    if (!isOpen) {
      setEditingCategory(null);
      setCategoryName('');
      setCurrentPage(1); // Reseteamos a la página 1 al cerrar
    }
  }, [isOpen]);

  const handleEditClick = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setCategoryName('');
  };

  const handleSave = async () => {
    if (!editingCategory || !categoryName.trim()) return;
    setLoading(true);
    await onSave(editingCategory.id, categoryName.trim());
    setLoading(false);
    handleCancelEdit();
  };

  const handleDelete = (category: Category) => {
    Swal.fire({
      title: `¿Eliminar "${category.name}"?`,
      text: "Esta acción podría afectar a los productos o servicios que usan esta categoría.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#438eff',
      confirmButtonText: 'Sí, ¡eliminar!',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        setLoading(true);
        await onDelete(category.id);
        setLoading(false);
      }
    });
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} centered>
      <ModalHeader toggle={toggle}>{title}</ModalHeader>
      <ModalBody>
        {loading && <div className="text-center"><Spinner /></div>}
        
        {categories.length === 0 && !loading && (
            <p className="text-center text-muted">No hay categorías para mostrar.</p>
        )}

        <ListGroup flush>
          {/* Usamos la lista paginada en lugar de la lista completa */}
          {paginatedCategories.map(cat => (
            <ListGroupItem key={cat.id} className="d-flex justify-content-between align-items-center">
              {editingCategory?.id === cat.id ? (
                <Input 
                  bsSize="sm"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              ) : (
                <span>{cat.name}</span>
              )}

              <div className="d-flex gap-2">
                {editingCategory?.id === cat.id ? (
                  <>
                    <Button color="success" size="sm" onClick={handleSave} disabled={loading}><i className="ri-check-line" /></Button>
                    <Button color="light" size="sm" onClick={handleCancelEdit} disabled={loading}><i className="ri-close-line" /></Button>
                  </>
                ) : (
                  <>
                    <Button color="soft-secondary" size="sm" onClick={() => handleEditClick(cat)} disabled={loading}><i className="ri-pencil-line" /></Button>
                    <Button color="soft-danger" size="sm" onClick={() => handleDelete(cat)} disabled={loading}><i className="ri-delete-bin-line" /></Button>
                  </>
                )}
              </div>
            </ListGroupItem>
          ))}
        </ListGroup>

        {/* --- COMPONENTE DE PAGINACIÓN --- */}
        {totalPages > 1 && (
            <div className="d-flex justify-content-end mt-3">
                <Pagination className="pagination-separated">
                    <PaginationItem disabled={currentPage <= 1}>
                        <PaginationLink previous onClick={() => setCurrentPage(currentPage - 1)} />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => (
                        <PaginationItem active={i + 1 === currentPage} key={i}>
                            <PaginationLink onClick={() => setCurrentPage(i + 1)}>
                                {i + 1}
                            </PaginationLink>
                        </PaginationItem>
                    ))}
                    <PaginationItem disabled={currentPage >= totalPages}>
                        <PaginationLink next onClick={() => setCurrentPage(currentPage + 1)} />
                    </PaginationItem>
                </Pagination>
            </div>
        )}

      </ModalBody>
      <ModalFooter>
        <Button color="light" onClick={toggle}>Cerrar</Button>
      </ModalFooter>
    </Modal>
  );
};

export default CategoryManagerModal;